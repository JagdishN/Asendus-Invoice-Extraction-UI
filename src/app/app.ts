import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { TopNav } from './layout/top-nav/top-nav';
import { ToastHost } from './shared/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopNav, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
