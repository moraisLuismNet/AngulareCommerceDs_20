import { Component, OnInit, ViewChild, ElementRef, afterNextRender, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Subject } from 'rxjs';

// PrimeNG
import { ConfirmationService, MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUploadModule } from 'primeng/fileupload';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { DropdownModule } from 'primeng/dropdown';

// Services & Interfaces
import { IGroup } from '../EcommerceInterface';
import { GroupsService } from '../services/GroupsService';
import { GenresService } from '../services/GenresService';

@Component({
    selector: 'app-groups',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        InputNumberModule,
        DialogModule,
        ConfirmDialogModule,
        FileUploadModule,
        TooltipModule,
        MessageModule,
        DropdownModule
    ],
    templateUrl: './GroupsComponent.html',
    providers: [ConfirmationService, MessageService]
})
export class GroupsComponent implements OnInit, OnDestroy {
  @ViewChild('form') form!: NgForm;
  @ViewChild('fileInput') fileInput!: ElementRef;
  visibleError = false;
  errorMessage = '';
  groups: IGroup[] = [];
  filteredGroups: IGroup[] = [];
  visibleConfirm = false;
  imageGroup = '';
  visiblePhoto = false;
  photo = '';
  searchText: string = '';

  group: IGroup = {
    idGroup: 0,
    nameGroup: '',
    imageGroup: null,
    photo: null,
    musicGenreId: null,
    musicGenreName: '',
    musicGenre: '',
  };

  genres: any[] = [];
  @ViewChild('groupsTable') groupsTable!: ElementRef<HTMLTableElement>;
  private resizeObserver!: ResizeObserver;
  private destroy$ = new Subject<void>();

  // Services injected using inject()
  private groupsService = inject(GroupsService);
  private genresService = inject(GenresService);
  private confirmationService = inject(ConfirmationService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // Runs once after initial rendering
    afterNextRender(() => {
      this.setupTableResizeObserver();
    });
  }

  ngOnInit(): void {
    this.getGroups();
    this.getGenres();
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (data: any) => {
        // Directly assign the response array (without using .$values)
        this.groups = Array.isArray(data) ? data : [];
        this.filteredGroups = [...this.groups];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching groups:', err);
        this.visibleError = true;
        this.errorMessage = 'Failed to load groups. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  getGenres() {
    this.genresService.getGenres().subscribe({
      next: (data: any) => {
        // Extract the `$values` property from the response
        const genresArray = data.$values || []; // If `$values` does not exist, use an empty array
        this.genres = Array.isArray(genresArray) ? genresArray : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  filterGroups() {
    this.filteredGroups = this.groups.filter((group) =>
      group.nameGroup.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  private setupTableResizeObserver(): void {
    if (!this.groupsTable) return;
    
    this.resizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
        console.log('The group table has been resized:', entry.contentRect);
        this.adjustTableColumns();
      });
    });
    
    this.resizeObserver.observe(this.groupsTable.nativeElement);
  }

  private adjustTableColumns(): void {
    if (!this.groupsTable) return;
    
    const table = this.groupsTable.nativeElement;
    const containerWidth = table.offsetWidth;
    const headers = table.querySelectorAll('th');
    
    // Adjust column widths based on container width
    if (containerWidth < 768) {
      // Mobile view
      headers.forEach((header, index) => {
        if (index > 1) {
          header.style.display = 'none';
        } else {
          header.style.display = 'table-cell';
          header.style.width = index === 0 ? '60%' : '40%';
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

  onSearchChange() {
    this.filterGroups();
  }

  save() {
    if (this.group.idGroup === 0) {
      this.groupsService.addGroup(this.group).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.form.reset();
          this.getGroups();
        },
        error: (err) => {
          console.log(err);
          this.visibleError = true;
          this.controlError(err);
        },
      });
    } else {
      this.groupsService.updateGroup(this.group).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.reset();
          this.getGroups();
        },
        error: (err) => {
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  edit(group: IGroup) {
    this.group = { ...group };
    this.group.photoName = group.imageGroup
      ? this.extractNameImage(group.imageGroup)
      : '';
  }

  extractNameImage(url: string): string {
    return url.split('/').pop() || '';
  }

  cancelEdition() {
    this.group = {
      idGroup: 0,
      nameGroup: '',
      imageGroup: null,
      photo: null,
      musicGenreId: 0,
      musicGenreName: '',
      musicGenre: '',
    };
  }

  confirmDelete(group: IGroup) {
    this.confirmationService.confirm({
      message: `Delete the group ${group.nameGroup}?`,
      header: 'Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteGroup(group.idGroup!),
    });
  }

  deleteGroup(id: number) {
    this.groupsService.deleteGroup(id).subscribe({
      next: (data) => {
        this.visibleError = false;
        this.form.reset({
          nameMusicGenre: '',
        });
        this.getGroups();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  controlError(err: any) {
    if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = 'An unexpected error has occurred';
    }
  }

  onChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.group.photo = file;
      this.group.photoName = file.name;
    }
  }

  showImage(group: IGroup) {
    if (this.visiblePhoto && this.group === group) {
      this.visiblePhoto = false;
    } else {
      this.group = group;
      this.photo = group.imageGroup!;
      this.visiblePhoto = true;
    }
  }

  ngOnDestroy(): void {
    // Clear the resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
