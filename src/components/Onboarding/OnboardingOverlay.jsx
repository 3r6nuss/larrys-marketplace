import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import confetti from 'canvas-confetti';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingOverlay({ role }) {
  const { user, completeOnboarding } = useAuth();
  const tourStarted = useRef(false);

  useEffect(() => {
    // Only run if user has not completed onboarding and tour hasn't started yet
    if (!user || user.has_completed_onboarding === 1 || tourStarted.current) {
      return;
    }

    tourStarted.current = true;

    // Define steps based on role
    let steps = [];

    if (role === 'inhaber' || role === 'superadmin' || role === 'stv_admin') {
      steps = [
        {
          popover: {
            title: 'Willkommen in der Kommandozentrale! 👑',
            description: 'Lass uns einen kurzen Rundgang durch dein neues Admin-Panel machen. Keine Sorge, es dauert nur eine Minute.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-users',
          popover: {
            title: 'Benutzerverwaltung 👥',
            description: 'Hier kannst du neue Mitarbeiter einladen, Rollen verteilen und im Notfall Accounts sperren.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '#tour-stats',
          popover: {
            title: 'Analytics & KPIs 📊',
            description: 'Deine wichtigsten Kennzahlen, Verkäufe und Umsätze auf einen Blick. Wissen ist Macht!',
            side: 'left',
            align: 'start'
          }
        },
        {
          popover: {
            title: 'Das war\'s schon! 🎉',
            description: 'Du hast jetzt den vollen Überblick. Viel Erfolg bei der Verwaltung von Larry\'s Marketplace!',
          }
        }
      ];
    } else if (role === 'mitarbeiter') {
      steps = [
        {
          popover: {
            title: 'Willkommen an Bord! 🚀',
            description: 'Wir zeigen dir kurz, wo du deine täglichen Aufgaben und To-Dos findest.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-tickets',
          popover: {
            title: 'Support Tickets 🎫',
            description: 'Hier landen alle neuen Aufträge und Kundenanfragen. Dein primärer Arbeitsplatz!',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '#tour-listings',
          popover: {
            title: 'Fahrzeuginserate 🚗',
            description: 'Hier kannst du Inserate anlegen, verwalten und als verkauft markieren.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#tour-vault',
          popover: {
            title: 'Dein Tresor 💰',
            description: 'Hier sammelt sich deine Provision für erfolgreich abgeschlossene Verkäufe.',
            side: 'right',
            align: 'start'
          }
        },
        {
          popover: {
            title: 'Bereit zum Start! 🎉',
            description: 'Pro-Tipp: Nutze "Strg + K", um jederzeit die globale Suche zu öffnen. Viel Spaß bei der Arbeit!',
          }
        }
      ];
    } else {
      return; // Fallback, falls weder Inhaber noch Mitarbeiter
    }

    const driverObj = driver({
      showProgress: true,
      animate: true,
      doneBtnText: 'Fertig',
      nextBtnText: 'Weiter',
      prevBtnText: 'Zurück',
      allowClose: true,
      overlayColor: 'rgba(0, 0, 0, 0.7)',
      steps: steps,
      onDestroyed: () => {
        // Run confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });
        
        // Mark as completed in backend and context
        completeOnboarding();
      }
    });

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      driverObj.drive();
    }, 500);

  }, [user, role, completeOnboarding]);

  return null;
}
