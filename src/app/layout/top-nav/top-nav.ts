import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './top-nav.html',
  styleUrl: './top-nav.scss'
})
export class TopNav {
  protected readonly features = environment.features;

  constructor(protected readonly auth: AuthService) {}
}
