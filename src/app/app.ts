import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { TopNav } from './layout/top-nav/top-nav';
import { ToastHost } from './shared/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopNav, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);

  // The login page is a standalone auth screen — showing the app nav (with a
  // redundant "Login" link) there looks broken, so it's hidden for that route.
  protected readonly showNav = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => !event.urlAfterRedirects.startsWith('/login'))
    ),
    { initialValue: !this.router.url.startsWith('/login') }
  );
}
