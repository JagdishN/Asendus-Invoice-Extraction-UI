import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { featureFlagGuard } from './core/guards/feature-flag.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'upload' },
  {
    path: 'upload',
    canActivate: [authGuard],
    loadComponent: () => import('./features/upload/upload-page/upload-page').then((m) => m.UploadPage)
  },
  {
    path: 'login',
    canActivate: [featureFlagGuard('enableLogin')],
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage)
  },
  {
    path: 'history',
    canActivate: [authGuard, featureFlagGuard('enableHistory')],
    loadComponent: () =>
      import('./features/history/history-list/history-list-page').then((m) => m.HistoryListPage)
  },
  {
    path: 'history/:jobId',
    canActivate: [authGuard, featureFlagGuard('enableHistory')],
    loadComponent: () =>
      import('./features/history/history-detail/history-detail-page').then((m) => m.HistoryDetailPage)
  },
  {
    path: 'jobs/:jobId/preview',
    canActivate: [authGuard],
    loadComponent: () => import('./features/preview/preview-page/preview-page').then((m) => m.PreviewPage)
  },
  { path: '**', redirectTo: 'upload' }
];
