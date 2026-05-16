# Backend Jobs

Ce dossier contient les jobs planifiés (cron jobs) pour ChainCacao.

## Jobs Disponibles

### 1. Verification Reminders (`verification-reminders.js`)

**Fonctionnalité:** Envoie des rappels aux vérificateurs et escalade les lots bloqués au Ministère.

**Fréquence recommandée:** Toutes les heures

**Commande:**
```bash
npm run job:verification-reminders
```

**Actions:**
- **Rappels 48h:** Envoie un rappel aux vérificateurs pour les lots en attente de vote depuis plus de 48h
- **Escalade 72h:** Escalade les lots bloqués depuis plus de 72h au Ministère et change leur statut en `escalated`

## Configuration Cron

### Linux/Mac (crontab)

Éditer crontab:
```bash
crontab -e
```

Ajouter (exécute toutes les heures):
```
0 * * * * cd /path/to/tg45/backend && npm run job:verification-reminders >> /var/log/chaincacao-jobs.log 2>&1
```

### Windows (Task Scheduler)

1. Ouvrir "Planificateur de tâches"
2. Créer une nouvelle tâche
3. Déclencheur: Répéter toutes les heures
4. Action: Démarrer un programme
   - Programme: `cmd.exe`
   - Arguments: `/c cd C:\path\to\tg45\backend && npm run job:verification-reminders`

### Docker/Kubernetes

Utiliser un CronJob Kubernetes ou un conteneur séparé avec cron:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: verification-reminders
spec:
  schedule: "0 * * * *"  # Toutes les heures
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: job
            image: chaincacao-backend:latest
            command: ["npm", "run", "job:verification-reminders"]
          restartPolicy: OnFailure
```

## Monitoring

Les jobs loggent dans stdout/stderr. Pour production, intégrer avec:
- CloudWatch Logs (AWS)
- Stackdriver (GCP)
- Application Insights (Azure)
- Datadog / New Relic

## Notifications

Actuellement, les notifications sont loguées seulement. Pour activer les vrais envois:

1. **Email:** Intégrer SendGrid, Mailgun, ou AWS SES
2. **SMS:** Intégrer Twilio
3. **Push notifications:** Intégrer Firebase Cloud Messaging

Décommenter les sections `// TODO: Send notification` dans le code et implémenter.

## Tests

Tester manuellement:
```bash
# Test local
cd backend
npm run job:verification-reminders

# Vérifier les logs
tail -f /var/log/chaincacao-jobs.log
```

## Dépannage

**Job ne s'exécute pas:**
- Vérifier les permissions d'exécution
- Vérifier que PostgreSQL est accessible
- Vérifier les variables d'environnement (DATABASE_URL)

**Lots non détectés:**
- Vérifier les timestamps dans la base de données
- Vérifier que voteDeadline est défini
- Vérifier les conditions WHERE dans le code

**Performances:**
Si > 10,000 lots, optimiser les requêtes avec pagination.
