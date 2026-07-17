import { lazy, Suspense } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const ListingsPage = lazy(() => import('@/pages/ListingsPage'));
const TicketsPage = lazy(() => import('@/pages/TicketsPage'));
const VaultPage = lazy(() => import('@/pages/VaultPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const AuditLogsPage = lazy(() => import('@/pages/AuditLogsPage'));
const CatalogAdminPage = lazy(() => import('@/pages/CatalogAdminPage'));
const CatalogPage = lazy(() => import('@/pages/CatalogPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const VehicleRequestsPage = lazy(() => import('@/pages/VehicleRequestsPage'));
const BackupPage = lazy(() => import('@/pages/BackupPage'));

const MODAL_MAP = {
 listings: ListingsPage,
 tickets: TicketsPage,
 vault: VaultPage,
 stats: StatsPage,
 users: UsersPage,
 logs: AuditLogsPage,
 catalog_admin: CatalogAdminPage,
 catalog: CatalogPage,
 profile: ProfilePage,
 leaderboard: LeaderboardPage,
 activity: ActivityPage,
 requests: VehicleRequestsPage,
 backup: BackupPage,
};

function ModalFallback() {
 return (
 <div className="space-y-4 p-4">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-4 w-80" />
 <div className="grid grid-cols-2 gap-3">
 <Skeleton className="h-32 w-full" />
 <Skeleton className="h-32 w-full" />
 </div>
 </div>
 );
}

export default function PopupShell({ activeModal, onClose }) {
 const ModalComponent = activeModal ? MODAL_MAP[activeModal] : null;

 return (
 <Dialog open={!!activeModal} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[1200px] xl:max-w-[1350px] h-[90vh] overflow-x-hidden overflow-y-auto bg-background/95 border-border/50">
 <div className="min-w-0 p-0 sm:p-2 h-full">
 <Suspense fallback={<ModalFallback />}>
 {ModalComponent && <ModalComponent isModal />}
 </Suspense>
 </div>
 </DialogContent>
 </Dialog>
 );
}
