import type { Notification } from "@/types/notification"

export const EXAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    title: "Maintenance programmée",
    content:
      "Une maintenance est prévue le 25 février 2026 de 02h00 à 04h00 UTC. Moddy sera temporairement indisponible. Merci de votre compréhension.",
    sender: { name: "Équipe Moddy", avatar: undefined },
    criticality: "warning",
    timestamp: new Date("2026-02-22T10:00:00Z"),
    read: false,
    actions: [
      {
        label: "En savoir plus",
        href: "https://status.moddy.app",
        variant: "outline",
      },
    ],
  },
  {
    id: "notif-2",
    title: "Connexion suspecte détectée",
    content:
      "Une tentative de connexion depuis un appareil inconnu a été détectée sur votre compte. Si vous n'êtes pas à l'origine de cette action, sécurisez votre compte immédiatement.",
    sender: { name: "Sécurité Moddy", avatar: undefined },
    criticality: "critical",
    timestamp: new Date("2026-02-21T18:34:00Z"),
    read: false,
    actions: [
      {
        label: "Sécuriser mon compte",
        href: "https://moddy.app/account/security",
        variant: "destructive",
      },
      {
        label: "Ce n'est pas moi",
        href: "https://moddy.app/support",
        variant: "outline",
      },
    ],
  },
  {
    id: "notif-3",
    title: "Nouvelle fonctionnalité : Rapports automatiques",
    content:
      "Moddy peut désormais générer des rapports de modération hebdomadaires directement dans votre salon d'administration. Activez-la dans les paramètres de votre serveur.",
    sender: { name: "Équipe Moddy", avatar: undefined },
    criticality: "success",
    timestamp: new Date("2026-02-20T09:15:00Z"),
    read: false,
    actions: [
      {
        label: "Activer la fonctionnalité",
        href: "https://docs.moddy.app/features/auto-reports",
        variant: "default",
      },
    ],
  },
  {
    id: "notif-4",
    title: "Rapport d'activité hebdomadaire",
    content:
      "Votre serveur « Community Hub » a enregistré 42 infractions traitées, 3 bans et 128 avertissements cette semaine. La modération automatique a bloqué 17 spams.",
    sender: { name: "Community Hub", avatar: undefined },
    criticality: "info",
    timestamp: new Date("2026-02-17T08:00:00Z"),
    read: true,
    actions: [
      {
        label: "Voir le rapport complet",
        href: "#",
        variant: "outline",
      },
    ],
  },
  {
    id: "notif-5",
    title: "Utilisateur signalé",
    content:
      "L'utilisateur « TrollMaster#9876 » a été signalé 3 fois en moins de 24h sur votre serveur « Gaming Zone ». Une action manuelle est recommandée.",
    sender: { name: "Gaming Zone", avatar: undefined },
    criticality: "warning",
    timestamp: new Date("2026-02-16T14:22:00Z"),
    read: true,
    actions: [
      {
        label: "Voir les signalements",
        href: "#",
        variant: "default",
      },
    ],
  },
]
