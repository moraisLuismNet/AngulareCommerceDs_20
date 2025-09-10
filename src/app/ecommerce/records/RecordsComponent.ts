import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  afterNextRender,
  inject,
  DestroyRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from "@angular/core";
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from "@angular/forms";
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

// PrimeNG
import { ConfirmationService, MessageService } from "primeng/api";
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUploadModule } from 'primeng/fileupload';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { IRecord } from "../EcommerceInterface";
import { RecordsService } from "../services/RecordsService";
import { GroupsService } from "../services/GroupsService";
import { StockService } from "../services/StockService";
import { CartService } from "../services/CartService";
import { UserService } from "src/app/services/UserService";
import { MessageModule } from 'primeng/message';

@Component({
    selector: "app-records",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        InputNumberModule,
        DialogModule,
        ConfirmDialogModule,
        FileUploadModule,
        TooltipModule,
        MessageModule
    ],
    templateUrl: "./RecordsComponent.html",
    styleUrls: ["./RecordsComponent.css"],
    providers: [ConfirmationService, MessageService]
})
export class RecordsComponent implements OnInit {
  @ViewChild("form") form!: NgForm;
  @ViewChild("fileInput") fileInput!: ElementRef;
  @ViewChild("recordsTable") recordsTable!: ElementRef<HTMLTableElement>;
  visibleError = false;
  errorMessage = "";
  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  visibleConfirm = false;
  imageRecord = "";
  visiblePhoto = false;
  photo = "";
  searchText: string = "";

  record: IRecord = {
    idRecord: 0,
    titleRecord: "",
    yearOfPublication: null,
    imageRecord: null,
    photo: null,
    photoName: null,
    price: 0,
    stock: 0,
    discontinued: false,
    groupId: null,
    groupName: "",
    nameGroup: "",
  };

  // Flag to track if a file has been selected
  fileSelected: boolean = false;

  groups: any[] = [];
  recordService: any;
  private resizeObserver!: ResizeObserver;
  private destroyRef = inject(DestroyRef);
  
  // Services injected using inject()
  private recordsService = inject(RecordsService);
  private groupsService = inject(GroupsService);
  private confirmationService = inject(ConfirmationService);
  private stockService = inject(StockService);
  private cartService = inject(CartService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {

    // This will run after the next change detection cycle
    afterNextRender(() => {
      this.updateTableVisuals();
    });
  }

  ngOnInit(): void {
    this.getRecords();
    this.getGroups();

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ recordId, newStock }) => {
        const record = this.records.find((r) => r.idRecord === recordId);
        if (record) {
          record.stock = newStock;
          // Update filtered records as well
          const filteredRecord = this.filteredRecords.find(
            (r) => r.idRecord === recordId
          );
          if (filteredRecord) {
            filteredRecord.stock = newStock;
          }
        }
      });

    // Subscribe to cart updates
    this.cartService.cart$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cartItems) => {
        this.records.forEach((record) => {
          const cartItem = cartItems.find(
            (item) => item.idRecord === record.idRecord
          );
          record.inCart = !!cartItem;
          record.amount = cartItem ? cartItem.amount || 0 : 0;
        });
        this.filteredRecords = [...this.records];
      });
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private updateTableVisuals(): void {
    // Update any table visual elements
  }

  getRecords() {
    this.recordsService.getRecords().subscribe({
      next: (data: any) => {
        const recordsArray = Array.isArray(data)
          ? data
          : Array.isArray(data.$values)
          ? data.$values
          : Array.isArray(data.data)
          ? data.data
          : [];

        // Get the groups to assign names
        this.groupsService.getGroups().subscribe({
          next: (groupsResponse: any) => {
            const groups = Array.isArray(groupsResponse)
              ? groupsResponse
              : Array.isArray(groupsResponse.$values)
              ? groupsResponse.$values
              : [];

            // Assign the group name to each record
            recordsArray.forEach((record: IRecord) => {
              const group = groups.find(
                (g: { idGroup: number | null }) => g.idGroup === record.groupId
              );
              if (group) {
                record.groupName = group.nameGroup;
              }
            });

            this.records = recordsArray;
            this.filteredRecords = [...this.records];
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error("Error getting groups:", err);
            this.records = recordsArray;
            this.filteredRecords = [...this.records];
            this.cdr.detectChanges();
          },
        });
      },
      error: (err: any) => {
        console.error("Error getting records:", err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.detectChanges();
      },
    });
  }

  filterRecords() {
    if (!this.searchText?.trim()) {
      this.filteredRecords = [...this.records];
      return;
    }

    const searchTerm = this.searchText.toLowerCase();
    this.filteredRecords = this.records.filter((record) => {
      return (
        record.titleRecord?.toLowerCase().includes(searchTerm) ||
        record.groupName?.toLowerCase().includes(searchTerm) ||
        record.yearOfPublication?.toString().includes(searchTerm)
      );
    });
  }

  onSearchChange() {
    this.filterRecords();
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (response: any) => {
        // Flexible handling of different response structures
        let groupsArray = [];

        if (Array.isArray(response)) {
          // The answer is a direct array
          groupsArray = response;
        } else if (Array.isArray(response.$values)) {
          // The response has property $values
          groupsArray = response.$values;
        } else if (Array.isArray(response.data)) {
          // The response has data property
          groupsArray = response.data;
        } else {
          console.warn("Unexpected API response structure:", response);
        }

        this.groups = groupsArray;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error("Error loading groups:", err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.detectChanges();
      },
    });
  }

  onChange(event: any) {
    const file = event.target.files;

    if (file && file.length > 0) {
      this.record.photo = file[0];
      this.record.photoName = file[0].name;
      this.fileSelected = true;
    } else {
      this.fileSelected = false;
      this.record.photo = null;
      this.record.photoName = null;
    }
  }

  onAceptar() {
    this.fileInput.nativeElement.value = "";
  }

  showImage(record: IRecord) {
    if (this.visiblePhoto && this.record === record) {
      this.visiblePhoto = false;
    } else {
      this.record = record;
      this.photo = record.imageRecord!;
      this.visiblePhoto = true;
    }
  }

  save() {
    if (this.record.idRecord === 0) {
      this.recordsService.addRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.resetForm();
          this.getRecords();
        },
        error: (err) => {
          console.error('Error adding record:', err);
          this.visibleError = true;
          this.controlError(err);
        },
      });
    } else {
      this.recordsService.updateRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.resetForm();
          this.getRecords();
        },
        error: (err) => {
          console.error('Error updating record:', err);
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  confirmDelete(record: IRecord) {
    this.confirmationService.confirm({
      message: `Delete record ${record.titleRecord}?`,
      header: "Are you sure?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Yes",
      acceptButtonStyleClass: "p-button-danger",
      accept: () => this.deleteRecord(record.idRecord),
    });
  }

  deleteRecord(id: number) {
    this.recordsService.deleteRecord(id).subscribe({
      next: (data: IRecord) => {
        this.visibleError = false;
        this.getRecords();
      },
      error: (err: any) => {
        this.visibleError = true;
        this.controlError(err);
        this.cdr.detectChanges();
      },
    });
  }

  edit(record: IRecord) {
    // Create a new object with all properties from record
    this.record = { ...record };
    
    // Ensure groupId is properly set (could be null or a number)
    this.record.groupId = record.groupId || null;
    
    if (this.record.stock === null || this.record.stock === undefined) {
      this.record.stock = 1;
    }
    this.record.photoName = record.imageRecord
      ? this.extractImageName(record.imageRecord)
      : "";
    // If there is an associated group, make sure the select reflects it
    if (record.groupId) {
      const selectedGroup = this.groups.find(
        (g) => g.idGroup === record.groupId
      );
      if (selectedGroup) {
        this.record.groupName = selectedGroup.nameGroup;
      }
    }
  }

  extractImageName(url: string): string {
    return url.split("/").pop() || "";
  }

  cancelEdition() {
    this.record = {
      idRecord: 0,
      titleRecord: "",
      yearOfPublication: null,
      imageRecord: null,
      photo: null,
      photoName: null,
      price: 0,
      stock: 0,
      discontinued: false,
      groupId: null,
      groupName: "",
      nameGroup: "",
    };
  }

  controlError(err: any) {
    if (err.error && typeof err.error === "object" && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === "string") {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = "An unexpected error has occurred";
    }
  }

  addToCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail) return;

    this.cartService.addToCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.inCart = true;
        record.amount = (record.amount || 0) + 1;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error adding to cart:", error);
        // Revert local changes if it fails
        record.inCart = false;
        record.amount = 0;
        this.filteredRecords = [...this.records];
      }
    );
  }

  removeFromCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail || !record.inCart) return;

    this.cartService.removeFromCart(record).subscribe(
      (response) => {
        // Update UI locally
        record.amount = Math.max(0, (record.amount || 0) - 1);
        record.inCart = record.amount > 0;
        this.filteredRecords = [...this.records];
      },
      (error) => {
        console.error("Error removing from cart:", error);
        // Revert local changes if it fails
        record.amount = (record.amount || 0) + 1;
        record.inCart = true;
        this.filteredRecords = [...this.records];
      }
    );
  }
}
