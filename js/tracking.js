/**
 * OmniDesk Tracking Module v2.0 - Système de tracking comportemental avancé
 * Intégration: Brevo + n8n + Supabase
 * 
 * Nouveautés v2.0:
 * - Double tracking: Brevo (marketing) + Supabase (analytics)
 * - Format optimisé pour dashboard Appsmith
 * - Résilience améliorée avec retry automatique
 * - Déduplication des événements
 */

class OmniDeskTracker {
    constructor(config = {}) {
        // Configuration
        this.config = {
            n8nWebhook: config.n8nWebhook || 'https://n8n.j-aime.fr/webhook/omnidesk-tracking',
            enableBrevo: config.enableBrevo !== false, // true par défaut
            enableN8n: config.enableN8n !== false, // true par défaut
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 2000,
            ...config
        };

        // Session & État
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.userData = {};
        this.formInteractions = {};
        this.calculatorStartTime = null;
        this.quizStartTime = null;
        this.engagementTimer = null;
        this.scrollDepth = 0;
        this.sectionsViewed = new Set();

        // States
        this.calculatorTouched = false;
        this.formStarted = false;
        this.identifiedUser = null;

        // Queue avec déduplication
        this.eventQueue = JSON.parse(localStorage.getItem('omnidesk_events') || '[]');
        this.sentEventIds = new Set(JSON.parse(localStorage.getItem('omnidesk_sent_ids') || '[]'));

        this.init();
    }

    /**
     * Initialisation du tracker
     */
    init() {
        this.setupEventListeners();
        this.trackPageView();
        this.startEngagementTracking();
        this.processEventQueue();
        this.cleanupOldEvents();
    }

    /**
     * Génère un ID de session unique
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Génère un ID unique pour chaque événement
     */
    generateEventId() {
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Détecte le type d'appareil
     */
    getDeviceType() {
        return window.innerWidth <= 768 ? 'mobile' : 'desktop';
    }

    /**
     * Récupère les paramètres UTM
     */
    getUtmParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            utm_source: urlParams.get('utm_source') || 'direct',
            utm_medium: urlParams.get('utm_medium') || null,
            utm_campaign: urlParams.get('utm_campaign') || null,
            utm_content: urlParams.get('utm_content') || null,
            utm_term: urlParams.get('utm_term') || null
        };
    }

    /**
     * Crée un événement de base avec métadonnées communes
     */
    createBaseEvent(eventType) {
        const utm = this.getUtmParameters();
        
        return {
            // Format pour n8n/Supabase
            event_id: this.generateEventId(),
            email: this.identifiedUser,
            event_type: eventType,
            event_source: 'landing_page',
            page_url: window.location.href,
            utm_source: utm.utm_source,
            utm_campaign: utm.utm_campaign,
            utm_medium: utm.utm_medium,
            metadata: {
                session_id: this.sessionId,
                device_type: this.getDeviceType(),
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent,
                referrer: document.referrer,
                utm_content: utm.utm_content,
                utm_term: utm.utm_term
            }
        };
    }

    /**
     * Envoie un événement à Brevo ET n8n avec fallback
     */
    async sendEvent(eventData) {
        const eventId = eventData.event_id;

        // Déduplication: vérifier si déjà envoyé
        if (this.sentEventIds.has(eventId)) {
            console.log('⏭️ Event already sent, skipping:', eventId);
            return;
        }

        const results = {
            brevo: false,
            n8n: false
        };

        // 1. Envoyer à Brevo (si activé)
        if (this.config.enableBrevo) {
            results.brevo = await this.sendToBrevo(eventData);
        }

        // 2. Envoyer à n8n/Supabase (si activé)
        if (this.config.enableN8n) {
            results.n8n = await this.sendToN8n(eventData);
        }

        // Si au moins un a réussi, marquer comme envoyé
        if (results.brevo || results.n8n) {
            this.markEventAsSent(eventId);
            console.log('✅ Event tracked:', eventData.event_type, results);
        } else {
            // Les deux ont échoué, mettre en queue
            this.queueEvent(eventData);
            console.warn('⚠️ Event queued for retry:', eventData.event_type);
        }
    }

    /**
     * Envoie à Brevo
     */
    async sendToBrevo(eventData) {
        try {
            if (typeof window.Brevo === 'undefined') {
                throw new Error('Brevo not loaded');
            }

            // Format Brevo: utiliser le nom d'événement original
            const brevoEvent = {
                event: eventData.event_type,
                timestamp: eventData.metadata.timestamp,
                session_id: eventData.metadata.session_id,
                device_type: eventData.metadata.device_type,
                ...eventData.metadata
            };

            window.Brevo.push(['track', brevoEvent.event, brevoEvent]);
            return true;

        } catch (error) {
            console.warn('❌ Brevo tracking failed:', error.message);
            return false;
        }
    }

    /**
     * Envoie à n8n/Supabase avec retry
     */
    async sendToN8n(eventData, attempt = 1) {
        try {
            const response = await fetch(this.config.n8nWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return true;

        } catch (error) {
            console.warn(`❌ n8n tracking failed (attempt ${attempt}/${this.config.retryAttempts}):`, error.message);

            // Retry automatique avec backoff exponentiel
            if (attempt < this.config.retryAttempts) {
                const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
                console.log(`🔄 Retrying in ${delay}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendToN8n(eventData, attempt + 1);
            }

            return false;
        }
    }

    /**
     * Met un événement en queue pour retry ultérieur
     */
    queueEvent(eventData) {
        this.eventQueue.push({
            ...eventData,
            queued_at: Date.now()
        });

        // Garder max 100 événements en queue
        if (this.eventQueue.length > 100) {
            this.eventQueue = this.eventQueue.slice(-100);
        }

        localStorage.setItem('omnidesk_events', JSON.stringify(this.eventQueue));
    }

    /**
     * Marque un événement comme envoyé
     */
    markEventAsSent(eventId) {
        this.sentEventIds.add(eventId);
        
        // Garder seulement les 1000 derniers IDs
        if (this.sentEventIds.size > 1000) {
            const idsArray = Array.from(this.sentEventIds);
            this.sentEventIds = new Set(idsArray.slice(-1000));
        }

        localStorage.setItem('omnidesk_sent_ids', JSON.stringify(Array.from(this.sentEventIds)));
    }

    /**
     * Traite la queue d'événements sauvegardés
     */
    async processEventQueue() {
        if (this.eventQueue.length === 0) return;

        console.log(`📦 Processing ${this.eventQueue.length} queued events...`);

        const eventsToProcess = [...this.eventQueue];
        this.eventQueue = [];

        for (const event of eventsToProcess) {
            // Ignorer les événements trop vieux (>24h)
            if (Date.now() - event.queued_at > 24 * 60 * 60 * 1000) {
                console.log('⏭️ Skipping old event:', event.event_type);
                continue;
            }

            const success = await this.sendToN8n(event);
            if (success) {
                this.markEventAsSent(event.event_id);
            } else {
                // Re-queue si échec
                this.eventQueue.push(event);
            }

            // Petit délai entre chaque event
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.eventQueue.length > 0) {
            localStorage.setItem('omnidesk_events', JSON.stringify(this.eventQueue));
            console.log(`⚠️ ${this.eventQueue.length} events still in queue`);
        } else {
            localStorage.removeItem('omnidesk_events');
            console.log('✅ All queued events processed');
        }
    }

    /**
     * Nettoie les événements de plus de 7 jours
     */
    cleanupOldEvents() {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        this.eventQueue = this.eventQueue.filter(event => 
            event.queued_at > sevenDaysAgo
        );

        if (this.eventQueue.length > 0) {
            localStorage.setItem('omnidesk_events', JSON.stringify(this.eventQueue));
        } else {
            localStorage.removeItem('omnidesk_events');
        }
    }

    /**
     * Configuration des event listeners
     */
    setupEventListeners() {
        this.setupCalculatorTracking();
        this.setupQuizTracking();
        this.setupFormTracking();
        this.setupCTATracking();
        this.setupScrollTracking();

        // Retry queue processing périodiquement
        setInterval(() => {
            if (this.eventQueue.length > 0) {
                this.processEventQueue();
            }
        }, 60000); // Toutes les minutes

        // Process queue when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.eventQueue.length > 0) {
                this.processEventQueue();
            }
        });
    }

    /**
     * Tracking de la vue de page initiale
     */
    trackPageView() {
        const eventData = this.createBaseEvent('page_view');
        eventData.metadata.referrer = document.referrer;
        eventData.metadata.screen_resolution = `${window.screen.width}x${window.screen.height}`;
        eventData.metadata.viewport_size = `${window.innerWidth}x${window.innerHeight}`;

        this.sendEvent(eventData);
    }

    /**
     * CALCULATEUR ROI - Setup tracking
     */
    setupCalculatorTracking() {
        const calculatorInputs = document.querySelectorAll('#emails, #time, #cost');
        const calculateButton = document.querySelector('.calculate-button');

        calculatorInputs.forEach(input => {
            input.addEventListener('focus', () => {
                if (!this.calculatorTouched) {
                    this.calculatorTouched = true;
                    this.calculatorStartTime = Date.now();

                    const eventData = this.createBaseEvent('roi_calculator_started');
                    eventData.metadata.default_values = {
                        emails_per_week: document.getElementById('emails')?.value || 0,
                        minutes_per_email: document.getElementById('time')?.value || 0,
                        hourly_cost: document.getElementById('cost')?.value || 0
                    };

                    this.sendEvent(eventData);
                }
            });
        });

        if (calculateButton) {
            calculateButton.addEventListener('click', () => {
                const timeSpent = this.calculatorStartTime ?
                    Math.round((Date.now() - this.calculatorStartTime) / 1000) : 0;

                const eventData = this.createBaseEvent('roi_calculator_completed');
                eventData.metadata.inputs = {
                    emails_per_week: parseInt(document.getElementById('emails')?.value) || 0,
                    minutes_per_email: parseInt(document.getElementById('time')?.value) || 0,
                    hourly_cost: parseInt(document.getElementById('cost')?.value) || 0
                };
                eventData.metadata.results = this.extractROIResults();
                eventData.metadata.time_spent_seconds = timeSpent;

                this.sendEvent(eventData);
            });
        }
    }

    /**
     * Extrait les résultats du ROI affichés
     */
    extractROIResults() {
        try {
            return {
                time_saved: document.getElementById('timeSaved')?.textContent || '',
                plan_recommended: document.getElementById('planRecommended')?.textContent || '',
                monthly_saving: document.getElementById('monthlySaving')?.textContent || '',
                roi_percent: document.getElementById('roiPercent')?.textContent || ''
            };
        } catch (error) {
            return {};
        }
    }

    /**
     * QUIZ PRIORITES - Setup tracking
     */
    setupQuizTracking() {
        const quizQuestions = document.querySelectorAll('.sib-radiobutton-group');

        quizQuestions.forEach((question, index) => {
            const radioInputs = question.querySelectorAll('input[type="radio"]');

            radioInputs.forEach(input => {
                input.addEventListener('change', () => {
                    if (!this.quizStartTime) {
                        this.quizStartTime = Date.now();
                    }

                    const eventData = this.createBaseEvent('quiz_interaction');
                    eventData.metadata.question_number = index + 1;
                    eventData.metadata.question_name = input.name;
                    eventData.metadata.selected_value = input.value;
                    eventData.metadata.selected_text = this.getRadioButtonText(input);
                    eventData.metadata.total_questions_answered = this.getAnsweredQuestionsCount();

                    this.sendEvent(eventData);

                    if (this.isQuizCompleted()) {
                        this.trackQuizCompletion();
                    }
                });
            });
        });
    }

    getRadioButtonText(input) {
        const label = input.closest('label');
        if (label) {
            const spans = label.querySelectorAll('span:not(.radio-button)');
            return spans.length > 0 ? spans[0].textContent.trim() : '';
        }
        return '';
    }

    getAnsweredQuestionsCount() {
        const questionNames = ['DEFIS_COMMUNICATION_ACTUELS', 'FONCTIONNALITES_PRIORITAIRES', 'OBJECTIFS_BUSINESS'];
        return questionNames.filter(name =>
            document.querySelector(`input[name="${name}"]:checked`)
        ).length;
    }

    isQuizCompleted() {
        return this.getAnsweredQuestionsCount() === 3;
    }

    trackQuizCompletion() {
        const timeSpent = this.quizStartTime ?
            Math.round((Date.now() - this.quizStartTime) / 1000) : 0;

        const eventData = this.createBaseEvent('quiz_completed');
        eventData.metadata.selected_priorities = this.getAllQuizAnswers();
        eventData.metadata.completion_time_seconds = timeSpent;

        this.sendEvent(eventData);
    }

    getAllQuizAnswers() {
        const answers = {};
        const questionNames = ['DEFIS_COMMUNICATION_ACTUELS', 'FONCTIONNALITES_PRIORITAIRES', 'OBJECTIFS_BUSINESS'];

        questionNames.forEach(name => {
            const checkedInput = document.querySelector(`input[name="${name}"]:checked`);
            if (checkedInput) {
                answers[name] = {
                    value: checkedInput.value,
                    text: this.getRadioButtonText(checkedInput)
                };
            }
        });

        return answers;
    }

    /**
     * FORMULAIRE - Setup tracking
     */
    setupFormTracking() {
        const form = document.getElementById('sib-form');
        if (!form) return;

        const formFields = form.querySelectorAll('input, select, textarea');
        let fieldOrder = 0;

        formFields.forEach(field => {
            field.addEventListener('focus', () => {
                if (!this.formStarted) {
                    this.formStarted = true;
                    
                    const eventData = this.createBaseEvent('form_start');
                    eventData.metadata.time_to_start_seconds = Math.round((Date.now() - this.startTime) / 1000);
                    this.sendEvent(eventData);
                }

                fieldOrder++;

                const eventData = this.createBaseEvent('form_field_interaction');
                eventData.metadata.field_name = field.name || field.id;
                eventData.metadata.field_type = field.type;
                eventData.metadata.field_order = fieldOrder;
                eventData.metadata.completion_percentage = this.getFormCompletionPercentage();

                this.sendEvent(eventData);
            });

            field.addEventListener('blur', () => {
                if (field.value.trim() !== '') {
                    const eventData = this.createBaseEvent('form_progress');
                    eventData.metadata.field_name = field.name || field.id;
                    eventData.metadata.completion_percentage = this.getFormCompletionPercentage();
                    eventData.metadata.filled_fields = this.getFilledFieldsCount();
                    eventData.metadata.total_fields = formFields.length;

                    this.sendEvent(eventData);
                }
            });

            if (field.name === 'EMAIL' || field.type === 'email') {
                field.addEventListener('blur', () => {
                    if (this.isValidEmail(field.value)) {
                        this.identifyUser(field.value);
                    }
                });
            }
        });

        form.addEventListener('submit', () => {
            const eventData = this.createBaseEvent('form_submit');
            eventData.metadata.completion_percentage = 100;
            eventData.metadata.total_time_seconds = Math.round((Date.now() - this.startTime) / 1000);
            eventData.metadata.source_context = this.getFormSourceContext();

            this.sendEvent(eventData);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.formStarted && this.getFormCompletionPercentage() < 100) {
                const eventData = this.createBaseEvent('form_abandoned');
                eventData.metadata.completion_percentage = this.getFormCompletionPercentage();
                eventData.metadata.last_field = this.getLastFilledField();
                eventData.metadata.time_spent_seconds = Math.round((Date.now() - this.startTime) / 1000);

                this.sendEvent(eventData);
            }
        });
    }

    getFormCompletionPercentage() {
        const form = document.getElementById('sib-form');
        if (!form) return 0;

        const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
        const filledRequiredFields = Array.from(requiredFields).filter(field =>
            field.value.trim() !== ''
        );

        return Math.round((filledRequiredFields.length / requiredFields.length) * 100);
    }

    getFilledFieldsCount() {
        const form = document.getElementById('sib-form');
        if (!form) return 0;

        const fields = form.querySelectorAll('input, select, textarea');
        return Array.from(fields).filter(field => field.value.trim() !== '').length;
    }

    getFormSourceContext() {
        return {
            after_calculator: this.calculatorTouched,
            after_quiz: this.quizStartTime !== null,
            quiz_completed: this.isQuizCompleted()
        };
    }

    getLastFilledField() {
        const form = document.getElementById('sib-form');
        if (!form) return null;

        const fields = Array.from(form.querySelectorAll('input, select, textarea'));
        let lastFilled = null;

        for (let i = fields.length - 1; i >= 0; i--) {
            if (fields[i].value.trim() !== '') {
                lastFilled = fields[i].name || fields[i].id;
                break;
            }
        }

        return lastFilled;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    identifyUser(email) {
        if (this.identifiedUser !== email) {
            const previousEmail = this.identifiedUser;
            this.identifiedUser = email;

            // Identifier dans Brevo
            if (this.config.enableBrevo && typeof window.Brevo !== 'undefined') {
                window.Brevo.push(['identify', { email: email }]);
            }

            const eventData = this.createBaseEvent('user_identified');
            eventData.email = email;
            eventData.metadata.identification_context = this.getIdentificationContext();
            eventData.metadata.previous_email = previousEmail;

            this.sendEvent(eventData);

            // Re-traiter la queue avec le nouvel email
            if (this.eventQueue.length > 0) {
                this.eventQueue = this.eventQueue.map(event => ({
                    ...event,
                    email: email
                }));
                localStorage.setItem('omnidesk_events', JSON.stringify(this.eventQueue));
            }
        }
    }

    getIdentificationContext() {
        return {
            time_to_identification: Math.round((Date.now() - this.startTime) / 1000),
            interactions_before_id: {
                calculator_used: this.calculatorTouched,
                quiz_started: this.quizStartTime !== null,
                quiz_completed: this.isQuizCompleted()
            }
        };
    }

    /**
     * CTA - Setup tracking
     */
    setupCTATracking() {
        const mainCTA = document.querySelector('.sib-form-block__button');

        if (mainCTA) {
            mainCTA.addEventListener('click', () => {
                const eventData = this.createBaseEvent('cta_clicked');
                eventData.metadata.cta_text = mainCTA.textContent.trim();
                eventData.metadata.cta_type = 'form_submit';
                eventData.metadata.context = this.getCTAContext();
                eventData.metadata.scroll_position = Math.round(window.scrollY);
                eventData.metadata.time_since_arrival = Math.round((Date.now() - this.startTime) / 1000);

                this.sendEvent(eventData);
            });
        }

        const calcButton = document.querySelector('.calculate-button');
        if (calcButton) {
            calcButton.addEventListener('click', () => {
                const eventData = this.createBaseEvent('cta_clicked');
                eventData.metadata.cta_text = calcButton.textContent.trim();
                eventData.metadata.cta_type = 'roi_calculator';
                eventData.metadata.context = this.getCTAContext();
                eventData.metadata.scroll_position = Math.round(window.scrollY);
                eventData.metadata.time_since_arrival = Math.round((Date.now() - this.startTime) / 1000);

                this.sendEvent(eventData);
            });
        }
    }

    getCTAContext() {
        return {
            after_calculator: this.calculatorTouched,
            after_quiz: this.isQuizCompleted(),
            form_progress: this.getFormCompletionPercentage(),
            sections_viewed: Array.from(this.sectionsViewed)
        };
    }

    /**
     * ENGAGEMENT - Setup tracking
     */
    startEngagementTracking() {
        this.engagementTimer = setInterval(() => {
            const eventData = this.createBaseEvent('page_engagement');
            eventData.metadata.total_time_seconds = Math.round((Date.now() - this.startTime) / 1000);
            eventData.metadata.scroll_depth_percentage = this.scrollDepth;
            eventData.metadata.sections_viewed = Array.from(this.sectionsViewed);
            eventData.metadata.interactions = {
                calculator_touched: this.calculatorTouched,
                quiz_answers: this.getAnsweredQuestionsCount(),
                form_progress: this.getFormCompletionPercentage()
            };

            this.sendEvent(eventData);
        }, 30000);
    }

    setupScrollTracking() {
        let ticking = false;

        const updateScrollDepth = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = Math.round((scrollTop / docHeight) * 100);

            this.scrollDepth = Math.max(this.scrollDepth, scrollPercent);
            this.detectVisibleSections();

            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollDepth);
                ticking = true;
            }
        });
    }

    detectVisibleSections() {
        const sections = document.querySelectorAll('.section');
        const windowHeight = window.innerHeight;

        sections.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            if (rect.top < windowHeight && rect.bottom > 0) {
                this.sectionsViewed.add(`section_${index + 1}`);
            }
        });
    }

    /**
     * Méthode publique pour envoyer des événements custom
     */
    track(eventType, customMetadata = {}) {
        const eventData = this.createBaseEvent(eventType);
        eventData.metadata = {
            ...eventData.metadata,
            ...customMetadata
        };
        
        this.sendEvent(eventData);
    }

    /**
     * Méthode publique pour obtenir les stats de session
     */
    getSessionStats() {
        return {
            session_id: this.sessionId,
            duration_seconds: Math.round((Date.now() - this.startTime) / 1000),
            identified_user: this.identifiedUser,
            interactions: {
                calculator_touched: this.calculatorTouched,
                quiz_completed: this.isQuizCompleted(),
                form_started: this.formStarted,
                form_completion: this.getFormCompletionPercentage()
            },
            engagement: {
                scroll_depth: this.scrollDepth,
                sections_viewed: Array.from(this.sectionsViewed).length
            },
            queue_size: this.eventQueue.length
        };
    }

    /**
     * Nettoyage à la fermeture
     */
    cleanup() {
        if (this.engagementTimer) {
            clearInterval(this.engagementTimer);
        }

        // Dernière tentative d'envoi de la queue
        if (this.eventQueue.length > 0) {
            this.processEventQueue();
        }
    }
}

// Initialisation automatique avec configuration
let omniDeskTracker = null;

document.addEventListener('DOMContentLoaded', function() {
    // Configuration personnalisable
    const trackerConfig = {
        n8nWebhook: 'https://n8n.j-aime.fr/webhook/omnidesk-tracking',
        enableBrevo: true,
        enableN8n: true,
        retryAttempts: 3,
        retryDelay: 2000
    };

    omniDeskTracker = new OmniDeskTracker(trackerConfig);

    // Nettoyage avant fermeture
    window.addEventListener('beforeunload', () => {
        if (omniDeskTracker) {
            omniDeskTracker.cleanup();
        }
    });

    // Exposer globalement pour debug
    window.omniDeskTracker = omniDeskTracker;

    console.log('📊 OmniDesk Tracker v2.0 initialized');
    console.log('Session ID:', omniDeskTracker.sessionId);
});

// Export pour utilisation externe
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OmniDeskTracker;
}