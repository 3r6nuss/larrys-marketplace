import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function ProfileNameDialog() {
  const { user, refetchUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);

  const profileComplete = user?.has_completed_profile == 1 || user?.has_completed_profile === true;
  const open = !!user && !profileComplete && !user.is_impersonating;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/users/me/profile-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Der Name konnte nicht gespeichert werden.');
        return;
      }

      await refetchUser();
      toast.success(`Willkommen, ${data.display_name}.`);
    } catch (error) {
      console.error('Error saving profile name:', error);
      toast.error('Netzwerkfehler.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Vervollständige dein Profil</DialogTitle>
            <DialogDescription>
              Gib nach der Discord-Anmeldung deinen Vor- und Nachnamen an. Dein Discord-Konto bleibt weiterhin mit demselben Benutzer verknüpft.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Vorname
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                minLength={2}
                maxLength={50}
                required
                autoFocus
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nachname
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                minLength={2}
                maxLength={50}
                required
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Namen speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
