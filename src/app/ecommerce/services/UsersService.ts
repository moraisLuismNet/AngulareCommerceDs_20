import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { IUser } from '../EcommerceInterface';
import { environment } from 'src/environments/environment';
import { AuthGuard } from '../../guards/AuthGuardService';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly urlAPI = environment.urlAPI;

  constructor(private http: HttpClient, private authGuard: AuthGuard) {}

  private getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getUsers(): Observable<IUser[]> {
    const headers = this.getHeaders();
    return this.http.get<any>(`${this.urlAPI}Users`, { headers }).pipe(
      map((response) => {
        // Extract the users array from the $values ​​property
        const usersArray = response?.$values || [];
        return usersArray as IUser[];
      }),
      catchError((error) => {
        console.error('Error in the request:', error);
        return of([]);
      })
    );
  }

  deleteUser(email: string): Observable<any> {
    const headers = this.getHeaders();
    return this.http.delete(
      `${this.urlAPI}Users/${encodeURIComponent(email)}`,
      { headers }
    );
  }
}
