import { Component, OnInit, ViewChild, ElementRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ILogin, ILoginResponse } from 'src/app/interfaces/LoginInterface';
import { AppService } from 'src/app/services/AppService';
import { AuthGuard } from 'src/app/guards/AuthGuardService';
import { UserService } from 'src/app/services/UserService';
import { jwtDecode } from 'jwt-decode';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessagesModule } from 'primeng/messages';

@Component({
    selector: 'app-login',
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        InputTextModule,
        ButtonModule,
        PasswordModule,
        ToastModule,
        MessagesModule
    ],
    templateUrl: './LoginComponent.html',
    styleUrls: ['./LoginComponent.css'],
    providers: [MessageService]
})
export class LoginComponent implements OnInit {
  @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>;
  @ViewChild('fLogin') loginForm!: NgForm;
  
  infoLogin: ILogin = {
    email: '',
    password: '',
    role: '',
  };
  
  // Services injected using inject()
  private router = inject(Router);
  private appService = inject(AppService);
  private messageService = inject(MessageService);
  private authGuard = inject(AuthGuard);
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);

  constructor() {}

  ngOnInit() {
    this.userService.setEmail(this.infoLogin.email);
    if (this.authGuard.isLoggedIn()) {
      this.router.navigateByUrl('/ecommerce/listgroups');
    }
  }

  ngAfterViewInit() {
    if (this.emailInput) {
      this.emailInput.nativeElement.focus();
    }
  }

  login() {
    this.appService.login(this.infoLogin).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: ILoginResponse) => {
        const decodedToken: any = jwtDecode(data.token);
        const role =
          decodedToken[
            'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
          ];
        sessionStorage.setItem('user', JSON.stringify({ ...data, role }));
        this.userService.setEmail(this.infoLogin.email);
        this.userService.setRole(role);
        this.userService.redirectBasedOnRole();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Wrong credentials',
        });
      },
    });
  }
}
