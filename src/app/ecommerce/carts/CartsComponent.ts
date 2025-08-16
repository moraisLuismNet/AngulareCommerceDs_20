import { Component, OnInit, afterNextRender, ElementRef, ViewChild, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';

// PrimeNG
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

// Services & Interfaces
import { UserService } from 'src/app/services/UserService';
import { CartService } from '../services/CartService';
import { ICart } from '../EcommerceInterface';

@Component({
    selector: 'app-carts',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        TableModule,
        InputTextModule,
        ButtonModule,
        TooltipModule,
        ProgressSpinnerModule,
        DialogModule,
        ConfirmDialogModule
    ],
    templateUrl: './CartsComponent.html',
    styleUrls: ['./CartsComponent.css'],
    providers: [MessageService, ConfirmationService]
})
export class CartsComponent implements OnInit, OnDestroy {
  carts: ICart[] = [];
  filteredCarts: ICart[] = [];
  loading = false;
  errorMessage = '';
  isAdmin = false;
  searchText: string = '';
  visibleError = false;
  
  @ViewChild('cartsTable') cartsTable!: ElementRef<HTMLTableElement>;
  private resizeObserver!: ResizeObserver;
  private destroy$ = new Subject<void>();

  // Services injected using inject()
  private cartService = inject(CartService);
  private userService = inject(UserService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // Execute once after initial rendering
    afterNextRender(() => {
      this.setupTableResizeObserver();
    });
  }

  ngOnInit(): void {
    this.isAdmin = this.userService.isAdmin();
    this.loadCarts();
  }

  loadCarts(): void {
    this.loading = true;

    if (this.isAdmin) {
      this.cartService.getAllCarts().subscribe({
        next: (data: any) => {
          // Extracts values ​​correctly from the response object
          const receivedCarts = data.$values || data;

          // Ensures that it is always an array
          this.carts = Array.isArray(receivedCarts)
            ? receivedCarts
            : [receivedCarts];

          this.filteredCarts = [...this.carts];
          this.loading = false;
          this.cdr.detectChanges();
          //this.cdr.detectChanges();
        },
        error: (error: any) => {
          console.error('Error:', error);
          this.errorMessage = 'Error loading carts';
          this.visibleError = true;
          this.loading = false;
          this.cdr.detectChanges();
          this.cdr.detectChanges();
        },
      });
    } else {
      const userEmail = this.userService.email;
      if (!userEmail) {
        this.errorMessage = 'No user logged in';
        this.visibleError = true;
        this.loading = false;
        return;
      }

      this.cartService.getCart(userEmail).subscribe({
        next: (data) => {
          this.carts = Array.isArray(data) ? data : [data];
          this.filteredCarts = [...this.carts];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          this.errorMessage = 'Error loading your cart';
          this.visibleError = true;
          this.loading = false;
          this.cdr.detectChanges();
          this.cdr.detectChanges();
        },
      });
    }
  }

  filterCarts() {
    if (!this.searchText) {
      this.filteredCarts = [...this.carts];
    } else {
      this.filteredCarts = this.carts.filter((cart) =>
        cart.userEmail.toLowerCase().includes(this.searchText.toLowerCase())
      );
    }
  }

  onSearchChange() {
    this.filterCarts();
  }

  // Method to navigate to details
  navigateToCartDetails(userEmail: string) {
    this.router.navigate(['/cart-details'], {
      queryParams: { email: userEmail },
    });
  }

  toggleCartStatus(email: string, enable: boolean): void {
    this.loading = true;

    const operation = enable
      ? this.cartService.enableCart(email)
      : this.cartService.disableCart(email);

    operation.subscribe({
      next: (updatedCart) => {
        // Update cart locally
        const cartIndex = this.carts.findIndex((c) => c.userEmail === email);
        if (cartIndex !== -1) {
          // Create a new array to trigger change detection
          this.carts = [
            ...this.carts.slice(0, cartIndex),
            {
              ...this.carts[cartIndex],
              enabled: enable,
              totalPrice: enable ? this.carts[cartIndex].totalPrice : 0,
            },
            ...this.carts.slice(cartIndex + 1)
          ];
          this.filterCarts(); // Refresh the filtered list
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error toggling cart status:', error);
        this.errorMessage = `Error ${enable ? 'enabling' : 'disabling'} cart`;
        this.visibleError = true;
        this.loading = false;
      },
    });
  }

  ngOnDestroy(): void {
    // Clear the resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupTableResizeObserver(): void {
    if (!this.cartsTable) return;
    
    this.resizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
        this.adjustTableColumns();
      });
    });
    
    this.resizeObserver.observe(this.cartsTable.nativeElement);
  }

  private adjustTableColumns(): void {
    if (!this.cartsTable) return;
    
    const table = this.cartsTable.nativeElement;
    const containerWidth = table.offsetWidth;
    const headers = table.querySelectorAll('th');
    
    // Adjust widths based on container width
    if (containerWidth < 768) {
      // Mobile view
      headers.forEach((header, index) => {
        if (index > 2) {
          header.style.display = 'none';
        } else {
          header.style.display = 'table-cell';
          header.style.width = index === 0 ? '40%' : '30%';
        }
      });
    } else {
      // Desktop view
      headers.forEach(header => {
        header.style.display = 'table-cell';
        header.style.width = ''; // Restore default width
      });
    }
  }

}
