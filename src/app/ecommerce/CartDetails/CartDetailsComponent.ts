import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  AfterViewInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subject, of, forkJoin } from "rxjs";
import { takeUntil, filter, map, catchError, switchMap } from "rxjs/operators";

// PrimeNG
import { ButtonModule } from "primeng/button";
import { InputNumberModule } from "primeng/inputnumber";
import { TableModule } from "primeng/table";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { MessageModule } from "primeng/message";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { DialogModule } from "primeng/dialog";
import { ConfirmationService, MessageService } from "primeng/api";

// Services & Interfaces
import {
  ICartDetail,
  IRecord,
  IGroup,
  GroupResponse,
  ExtendedCartDetail,
} from "../EcommerceInterface";
import { UserService } from "src/app/services/UserService";
import { CartDetailService } from "../services/CartDetailService";
import { CartService } from "src/app/ecommerce/services/CartService";
import { OrderService } from "../services/OrderService";
import { GroupsService } from "../services/GroupsService";

@Component({
  selector: "app-cart-details",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    TableModule,
    ProgressSpinnerModule,
    MessageModule,
    ConfirmDialogModule,
    DialogModule,
  ],
  templateUrl: "./CartDetailsComponent.html",
  styleUrls: ["./CartDetailsComponent.css"],
  providers: [ConfirmationService, MessageService],
})
export class CartDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("cartContainer") cartContainer!: ElementRef;

  cartDetails: ICartDetail[] = [];
  filteredCartDetails: ExtendedCartDetail[] = [];
  emailUser: string | null = "";
  isAddingToCart = false;
  private readonly destroy$ = new Subject<void>();
  currentViewedEmail: string = "";
  isViewingAsAdmin: boolean = false;
  isCreatingOrder = false;
  alertMessage: string = "";
  alertType: "success" | "error" | null = null;
  loading = false;
  visibleError = false;
  errorMessage = "";

  // State for scrolling
  private lastScrollPosition: number = 0;

  private readonly cdr = inject(ChangeDetectorRef);
  private handleScrollBound: (event: Event) => void;

  constructor(
    private readonly cartDetailService: CartDetailService,
    private readonly route: ActivatedRoute,
    private readonly userService: UserService,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly groupsService: GroupsService
  ) {
    // Bind the handleScroll method to maintain the correct 'this' context
    this.handleScrollBound = this.handleScroll.bind(this);
  }

  ngAfterViewInit(): void {
    // Initialize after the view is initialized
  }

  ngOnInit(): void {
    // Initialize scroll tracking
    this.initializeScrollTracking();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const viewingUserEmail = params["viewingUserEmail"];

        if (viewingUserEmail && this.userService.isAdmin()) {
          // Admin
          this.isViewingAsAdmin =
            viewingUserEmail && this.userService.isAdmin();
          this.currentViewedEmail = viewingUserEmail;
          this.isViewingAsAdmin = true;
          this.loadCartDetails(viewingUserEmail);
        } else {
          // User viewing their own cart
          this.userService.email$
            .pipe(
              takeUntil(this.destroy$),
              filter((email): email is string => !!email)
            )
            .subscribe((email) => {
              this.currentViewedEmail = email;
              this.isViewingAsAdmin = false;
              this.loadCartDetails(email);
            });
        }
      });
  }

  private loadCartDetails(email: string): void {
    this.cartDetailService
      .getCartDetailsByEmail(email)
      .pipe(
        takeUntil(this.destroy$),
        map((response: any) => {
          // If you are an admin or do not have a cart, the response will be an empty array.
          if (Array.isArray(response)) {
            return response;
          }
          // Handle backend response format
          return response?.$values || response?.Items || [];
        }),
        catchError((error) => {
          console.error("Error loading cart details:", error);
          return of([]); // Always return empty array on errors
        })
      )
      .subscribe((details) => {
        this.cartDetails = details;
        this.filteredCartDetails = this.getFilteredCartDetails();
        this.cdr.detectChanges();
        this.loadRecordDetails();
      });
  }

  private loadRecordDetails(): void {
    // First we get all the groups to have the names
    this.groupsService
      .getGroups()
      .pipe(
        takeUntil(this.destroy$),
        switchMap((groupsResponse: IGroup[] | GroupResponse) => {
          // Convert the response to an array of groups
          const groups = Array.isArray(groupsResponse)
            ? groupsResponse
            : (groupsResponse as GroupResponse)?.$values || [];

          // Create a map of groupId to groupName for quick search
          const groupMap = new Map<number, string>();
          groups.forEach((group: IGroup) => {
            if (group?.idGroup) {
              groupMap.set(group.idGroup, group.nameGroup || "");
            }
          });

          // For each detail in the cart, get the record details and assign the groupName
          const recordDetails$ = this.filteredCartDetails.map((detail) =>
            this.cartDetailService.getRecordDetails(detail.recordId).pipe(
              filter((record): record is IRecord => record !== null),
              map((record) => ({
                detail,
                record,
                groupName: record.groupId
                  ? groupMap.get(record.groupId) || ""
                  : "",
              }))
            )
          );

          return forkJoin(recordDetails$);
        })
      )
      .subscribe((results) => {
        results.forEach(({ detail, record, groupName }) => {
          const index = this.filteredCartDetails.findIndex(
            (d) => d.recordId === detail.recordId
          );

          if (index !== -1) {
            const updatedDetail = {
              ...this.filteredCartDetails[index],
              stock: record.stock,
              groupName: groupName || record.groupName || "",
              titleRecord:
                record.titleRecord ||
                this.filteredCartDetails[index].titleRecord,
              price: record.price || this.filteredCartDetails[index].price,
            } as ExtendedCartDetail;

            this.filteredCartDetails[index] = updatedDetail;
          }
        });

        // Force view refresh
        this.filteredCartDetails = [...this.filteredCartDetails];
        this.cdr.detectChanges();
      });
  }

  private getFilteredCartDetails(): ExtendedCartDetail[] {
    if (!Array.isArray(this.cartDetails)) return [];

    return this.cartDetails.filter(
      (detail) =>
        detail && typeof detail.amount === "number" && detail.amount > 0
    ) as ExtendedCartDetail[];
  }

  async addToCart(detail: ICartDetail): Promise<void> {
    if (!this.currentViewedEmail || this.isAddingToCart) return;

    this.isAddingToCart = true;
    this.clearAlert();

    try {
      const updatedDetail = await this.cartDetailService
        .addToCartDetail(this.currentViewedEmail, detail.recordId, 1)
        .toPromise();

      // Update UI locally first for better user experience
      const itemIndex = this.filteredCartDetails.findIndex(
        (d) => d.recordId === detail.recordId
      );
      if (itemIndex !== -1) {
        const updatedItem = {
          ...this.filteredCartDetails[itemIndex],
          amount: (this.filteredCartDetails[itemIndex].amount || 0) + 1,
          stock:
            updatedDetail?.stock || this.filteredCartDetails[itemIndex].stock,
        };
        this.filteredCartDetails[itemIndex] = updatedItem;
        this.updateCartTotals();
      }

      // Refresh data from the server
      await this.loadCartDetails(this.currentViewedEmail);

      // Sync CartService to update cartSubject
      this.cartService.syncCartWithBackend(this.currentViewedEmail);

      // Update the stock value in the UI
      const updatedRecord = await this.cartDetailService
        .getRecordDetails(detail.recordId)
        .toPromise();
      if (updatedRecord) {
        const stockIndex = this.filteredCartDetails.findIndex(
          (d) => d.recordId === detail.recordId
        );
        if (stockIndex !== -1) {
          this.filteredCartDetails[stockIndex].stock = updatedRecord.stock;
        }
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      // Revert local changes if it fails
      const itemIndex = this.filteredCartDetails.findIndex(
        (d) => d.recordId === detail.recordId
      );
      if (itemIndex !== -1) {
        this.filteredCartDetails[itemIndex].amount -= 1;
        this.updateCartTotals();
      }
    } finally {
      this.isAddingToCart = false;
    }
  }

  async removeRecord(detail: ICartDetail): Promise<void> {
    if (!this.currentViewedEmail || detail.amount <= 0) return;

    try {
      await this.cartDetailService
        .removeFromCartDetail(this.currentViewedEmail, detail.recordId, 1)
        .toPromise();

      // Update UI locally first for better user experience
      const itemIndex = this.filteredCartDetails.findIndex(
        (d) => d.recordId === detail.recordId
      );
      if (itemIndex !== -1) {
        const updatedItem = {
          ...this.filteredCartDetails[itemIndex],
          amount: Math.max(
            0,
            (this.filteredCartDetails[itemIndex].amount || 0) - 1
          ),
        };
        this.filteredCartDetails[itemIndex] = updatedItem;
        this.updateCartTotals();
      }

      // Refresh data from the server
      await this.loadCartDetails(this.currentViewedEmail);

      // Sync CartService to update cartSubject
      this.cartService.syncCartWithBackend(this.currentViewedEmail);

      // Update the stock value in the UI
      const updatedRecord = await this.cartDetailService
        .getRecordDetails(detail.recordId)
        .toPromise();
      if (updatedRecord) {
        const stockIndex = this.filteredCartDetails.findIndex(
          (d) => d.recordId === detail.recordId
        );
        if (stockIndex !== -1) {
          this.filteredCartDetails[stockIndex].stock = updatedRecord.stock;
        }
      }

      this.showAlert("Product removed from cart", "success");
    } catch (error) {
      console.error("Error removing from cart:", error);
      this.showAlert("Failed to remove product from cart", "error");
      // Revert local changes if it fails
      const itemIndex = this.filteredCartDetails.findIndex(
        (d) => d.recordId === detail.recordId
      );
      if (itemIndex !== -1) {
        this.filteredCartDetails[itemIndex].amount += 1;
        this.updateCartTotals();
      }
    }
  }

  private updateCartTotals(): void {
    const totalItems = this.filteredCartDetails.reduce(
      (sum, d) => sum + d.amount,
      0
    );
    const totalPrice = this.filteredCartDetails.reduce(
      (sum, d) => sum + (d.price || 0) * d.amount,
      0
    );
    this.cartService.updateCartNavbar(totalItems, totalPrice);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Clean up any scroll listeners
    if (this.handleScrollBound) {
      window.removeEventListener("scroll", this.handleScrollBound);
    }
  }

  private initializeScrollTracking(): void {
    if (this.cartContainer && this.cartContainer.nativeElement) {
      // Save initial scroll position
      this.lastScrollPosition = window.scrollY;

      // Add a listener for the scroll event
      window.addEventListener("scroll", this.handleScrollBound, {
        passive: true,
      });
    }
  }

  private handleScroll = (): void => {
    const currentScroll = window.scrollY;
    const cartElement = this.cartContainer?.nativeElement;

    if (cartElement) {
      // Hide/show elements based on scroll position
      if (currentScroll > 100 && currentScroll > this.lastScrollPosition) {
        // Scrolling down
        cartElement.classList.add("scrolling-down");
      } else {
        cartElement.classList.remove("scrolling-down");
      }

      this.lastScrollPosition = currentScroll;
    }
  };

  async createOrder(): Promise<void> {
    if (!this.currentViewedEmail || this.isViewingAsAdmin) return;

    this.isCreatingOrder = true;
    this.clearAlert();

    try {
      const paymentMethod = "credit-card";
      const order = await this.orderService
        .createOrderFromCart(this.currentViewedEmail, paymentMethod)
        .toPromise();

      this.showAlert("Order created successfully", "success");
      // Reset CartService state after order creation
      this.cartService.resetCart();
      this.loadCartDetails(this.currentViewedEmail);
    } catch (error: any) {
      console.error("Full error:", error);
      const errorMsg = error.error?.message || "Failed to create order";
      this.showAlert(errorMsg, "error");
    } finally {
      this.isCreatingOrder = false;
    }
  }

  private showAlert(message: string, type: "success" | "error"): void {
    this.alertMessage = message;
    this.alertType = type;

    // Hide the message after 5 seconds
    setTimeout(() => this.clearAlert(), 5000);
  }

  private clearAlert(): void {
    this.alertMessage = "";
    this.alertType = null;
  }
}
