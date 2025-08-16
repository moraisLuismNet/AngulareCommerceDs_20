import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthGuard } from 'src/app/guards/AuthGuardService';
import { IGroup } from '../EcommerceInterface';

@Injectable({
  providedIn: 'root',
})
export class GroupsService {
  urlAPI = environment.urlAPI;
  constructor(private http: HttpClient, private authGuard: AuthGuard) {}

  getGroups(): Observable<IGroup[]> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.urlAPI}groups`, {
        headers,
      })
      .pipe(
        map((response) => {
          const groups = response.$values || [];
          return Array.isArray(groups) ? groups : [];
        })
      );
  }

  addGroup(group: IGroup): Observable<IGroup> {
    const headers = this.getHeaders();
    const formData = new FormData();
    formData.append('nameGroup', group.nameGroup);
    if (group.photo) {
      formData.append('photo', group.photo);
    }
    formData.append('musicGenreId', group.musicGenreId?.toString()!);
    return this.http.post<IGroup>(`${this.urlAPI}groups`, formData, {
      headers,
    });
  }

  updateGroup(group: IGroup): Observable<IGroup> {
    const headers = this.getHeaders();
    const formData = new FormData();
    formData.append('nameGroup', group.nameGroup);
    formData.append('musicGenreId', group.musicGenreId?.toString()!);
    if (group.photo) {
      formData.append('photo', group.photo);
    }

    return this.http.put<IGroup>(
      `${this.urlAPI}groups/${group.idGroup}`,
      formData,
      { headers }
    );
  }

  deleteGroup(id: number): Observable<IGroup> {
    const headers = this.getHeaders();
    return this.http.delete<IGroup>(`${this.urlAPI}groups/${id}`, {
      headers,
    });
  }

  getGroupName(idGroup: string | number): Observable<string> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.urlAPI}groups/${idGroup}`, { headers })
      .pipe(
        map((response) => {
          
          // Handle direct group object
          if (
            response &&
            typeof response === 'object' &&
            'nameGroup' in response
          ) {
            return response.nameGroup;
          }

          // Handle $values wrapper
          if (
            response &&
            response.$values &&
            typeof response.$values === 'object'
          ) {
            if (
              Array.isArray(response.$values) &&
              response.$values.length > 0
            ) {
              return response.$values[0].nameGroup || '';
            }
            if ('nameGroup' in response.$values) {
              return response.$values.nameGroup;
            }
          }

          return '';
        })
      );
  }

  getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return headers;
  }
}
