# Documentation du Système de Tracking OmniDesk

## Vue d'ensemble

Le système de tracking comportemental OmniDesk analyse précisément les interactions des visiteurs sur la landing page pour optimiser les conversions et comprendre le parcours utilisateur.

## Événements Trackés

### 1. Page View (`page_view`)
**Déclenché** : Au chargement de la page
**Données collectées** :
- URL de la page
- Referrer
- User Agent
- Paramètres UTM
- Type d'appareil (mobile/desktop)

### 2. Calculateur ROI

#### `roi_calculator_started`
**Déclenché** : Premier focus sur un champ du calculateur
**Données collectées** :
- Valeurs par défaut des champs
- Timestamp de début

#### `roi_calculator_completed`
**Déclenché** : Clic sur "Recalculer mon ROI"
**Données collectées** :
- Valeurs saisies (emails/semaine, minutes/email, coût horaire)
- Résultats calculés (économie, plan suggéré, ROI%)
- Temps passé sur le calculateur

### 3. Quiz Priorités

#### `quiz_interaction`
**Déclenché** : À chaque sélection d'une option radio
**Données collectées** :
- Numéro de question (1-3)
- Nom du champ
- Valeur sélectionnée
- Texte de l'option
- Nombre total de questions répondues

#### `quiz_completed`
**Déclenché** : Quand les 3 questions sont répondues
**Données collectées** :
- Toutes les priorités sélectionnées
- Temps de complétion du quiz

### 4. Formulaire de Contact

#### `form_field_interaction`
**Déclenché** : Focus sur un champ du formulaire
**Données collectées** :
- Nom du champ
- Type de champ
- Ordre d'interaction
- Pourcentage de complétion

#### `form_progress`
**Déclenché** : À chaque champ rempli (blur)
**Données collectées** :
- Nom du champ
- Pourcentage de complétion
- Nombre de champs remplis/total

#### `form_abandoned`
**Déclenché** : Fermeture de page avec formulaire partiellement rempli
**Données collectées** :
- Pourcentage de complétion
- Dernier champ rempli
- Temps passé

#### `form_submitted`
**Déclenché** : Soumission du formulaire
**Données collectées** :
- Pourcentage de complétion (100%)
- Temps total passé
- Contexte source (après calculateur/quiz)

### 5. Identification Utilisateur (`user_identified`)
**Déclenché** : Saisie d'un email valide
**Données collectées** :
- Email de l'utilisateur
- Temps avant identification
- Interactions précédentes (calculateur, quiz)

### 6. CTA Principal (`cta_clicked`)
**Déclenché** : Clic sur les boutons d'action
**Données collectées** :
- Texte du CTA
- Type de CTA (form_submit, roi_calculator)
- Contexte (après calculateur/quiz)
- Position de scroll
- Temps depuis l'arrivée

### 7. Engagement Page (`page_engagement`)
**Déclenché** : Toutes les 30 secondes d'activité
**Données collectées** :
- Temps total passé
- Profondeur de scroll (%)
- Sections vues
- Interactions réalisées

## Architecture Technique

### Classe `OmniDeskTracker`

#### Propriétés principales :
- `sessionId` : ID unique de session
- `startTime` : Timestamp de début
- `calculatorStartTime` : Début d'interaction calculateur
- `quizStartTime` : Début d'interaction quiz
- `identifiedUser` : Email identifié
- `eventQueue` : Queue de sauvegarde locale

#### Méthodes principales :
- `init()` : Initialisation
- `sendEvent(eventData)` : Envoi avec fallback
- `setupCalculatorTracking()` : Listeners calculateur
- `setupQuizTracking()` : Listeners quiz
- `setupFormTracking()` : Listeners formulaire
- `setupCTATracking()` : Listeners CTA
- `identifyUser(email)` : Identification utilisateur

## Gestion des Erreurs

### Fallback localStorage
Si Brevo n'est pas disponible, les événements sont :
1. Sauvegardés dans `localStorage` sous `omnidesk_events`
2. Traités dès que Brevo se charge
3. Supprimés après envoi réussi

### Retry Logic
- Vérification périodique de la disponibilité de Brevo
- Retraitement automatique de la queue
- Logging des erreurs en console

## Configuration Brevo

```javascript
window.Brevo = window.Brevo || [];
Brevo.push([
    "init",
    {
        client_key: "cfqb94kpfbv0h3hu1iadm78e"
    }
]);
```

## Capture des Paramètres UTM et ID Brevo

### Champs cachés ajoutés au formulaire
- `UTM_SOURCE` : Capture automatique du paramètre `utm_source` de l'URL
- `BREVO_CONTACT_ID` : Capture automatique du paramètre `utm_id` de l'URL (ID contact Brevo)

### Script de capture automatique
```javascript
// Extraction automatique des paramètres UTM au chargement de page
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}
```

### Fonctionnalités
1. **Capture immédiate** : Extraction dès le chargement de la page
2. **Re-vérification** : Actualisation avant soumission du formulaire
3. **Logs de debug** : Console logs pour vérifier la capture
4. **Transmission webhook** : Données disponibles pour n8n → Pipedrive

### Paramètres supportés
- `utm_source` → Champ `UTM_SOURCE`
- `utm_medium` → Loggé pour debug
- `utm_campaign` → Loggé pour debug
- `utm_content` → Loggé pour debug
- `utm_term` → Loggé pour debug
- `utm_id` → Champ `BREVO_CONTACT_ID`

### URLs de test
```
https://votresite.com/?utm_source=facebook&utm_id=12345
https://votresite.com/?utm_source=google&utm_campaign=pilote&utm_id=67890
```

## Conformité RGPD

- ✅ Pas de tracking avant interaction utilisateur
- ✅ Données anonymisées par défaut
- ✅ Identification uniquement après saisie email volontaire
- ✅ Possibilité d'effacer les données localStorage
- ✅ Capture UTM transparente et non-intrusive

## Debugging

### Console Logs
- ✅ `Event tracked` : Événement envoyé avec succès
- ⚠️ `Failed to send event` : Erreur d'envoi, sauvegarde locale
- ✅ `Queued event processed` : Traitement queue réussi

### localStorage
Vérifier les événements en attente :
```javascript
JSON.parse(localStorage.getItem('omnidesk_events') || '[]')
```

### Vérification Brevo
```javascript
typeof window.Brevo !== 'undefined'
```

### Vérification Capture UTM
```javascript
// Vérifier les champs cachés UTM
console.log('UTM_SOURCE:', document.getElementById('UTM_SOURCE')?.value);
console.log('BREVO_CONTACT_ID:', document.getElementById('BREVO_CONTACT_ID')?.value);

// Vérifier les paramètres URL actuels
const urlParams = new URLSearchParams(window.location.search);
console.log('Paramètres URL:', Object.fromEntries(urlParams));
```

## Performance

- **Debouncing** : Scroll tracking optimisé avec `requestAnimationFrame`
- **Event delegation** : Listeners efficaces
- **Lazy loading** : Traitement asynchrone
- **Memory management** : Nettoyage automatique

## Métriques Business

### Conversion Funnel
1. Page View → Calculator Interaction
2. Calculator → Quiz Completion
3. Quiz → Form Start
4. Form Start → Email Identification
5. Email → Form Submission

### Engagement Metrics
- Temps moyen sur page
- Profondeur de scroll
- Taux d'interaction calculateur
- Taux de complétion quiz
- Taux d'abandon formulaire

### Optimisation
- A/B test des versions de calculateur
- Analyse des points d'abandon
- Corrélation ROI calculé / conversion
- Analyse des priorités les plus sélectionnées

## Maintenance

### Logs à surveiller
- Erreurs Brevo en console
- Taille de la queue localStorage
- Performances du tracking scroll

### Updates
- Client key Brevo
- Structure des événements
- Nouveaux champs de formulaire
- Nouvelles sections à tracker

## Intégration n8n et Pipedrive

### Workflow de données
1. **Formulaire Brevo** → Capture UTM_SOURCE + BREVO_CONTACT_ID
2. **Webhook Brevo** → Transmet toutes les données à n8n
3. **n8n Processing** → Enrichissement et validation des données
4. **Pipedrive Sync** → Création/mise à jour des contacts avec attribution source

### Champs disponibles pour n8n
```json
{
  "UTM_SOURCE": "facebook",
  "BREVO_CONTACT_ID": "12345",
  "EMAIL": "user@example.com",
  "PRENOM": "John",
  "NOM": "Doe",
  "estimatedROI": "250%",
  "pms": "MisterBooking",
  "DEFIS_COMMUNICATION_ACTUELS": "1",
  "FONCTIONNALITES_PRIORITAIRES": "2",
  "OBJECTIFS_BUSINESS": "3"
}
```

### Mapping Pipedrive recommandé
- `UTM_SOURCE` → Champ personnalisé "Source de lead"
- `BREVO_CONTACT_ID` → Champ personnalisé "ID Brevo"
- Formulaire standard → Champs contact Pipedrive
- ROI calculé → Champ personnalisé "ROI estimé"
- Priorités quiz → Tags ou champs personnalisés

## Intégration Future

Le système est conçu pour faciliter l'ajout de :
- Heatmaps (Hotjar, Crazy Egg)
- Analytics avancées (Mixpanel, Amplitude)
- Tests A/B (Optimizely)
- Chat proactif (Intercom, Crisp)