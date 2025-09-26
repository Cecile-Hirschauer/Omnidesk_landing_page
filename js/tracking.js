/**
 * OmniDesk Tracking Module - Système de tracking comportemental avancé
 * Intégration avec Brevo pour analyser le comportement des visiteurs
 */

class OmniDeskTracker {
    constructor() {
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

        // Backup storage pour les cas de problème réseau
        this.eventQueue = JSON.parse(localStorage.getItem('omnidesk_events') || '[]');

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
    }

    /**
     * Génère un ID de session unique
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
            utm_source: urlParams.get('utm_source') || null,
            utm_medium: urlParams.get('utm_medium') || null,
            utm_campaign: urlParams.get('utm_campaign') || null,
            utm_content: urlParams.get('utm_content') || null,
            utm_term: urlParams.get('utm_term') || null
        };
    }

    /**
     * Crée un événement de base avec métadonnées communes
     */
    createBaseEvent(eventName) {
        return {
            event: eventName,
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            page_url: window.location.href,
            device_type: this.getDeviceType(),
            utm_parameters: this.getUtmParameters(),
            user_email: this.identifiedUser
        };
    }

    /**
     * Envoie un événement à Brevo avec fallback localStorage
     */
    async sendEvent(eventData) {
        try {
            // Vérifier si Brevo est chargé
            if (typeof window.Brevo === 'undefined') {
                throw new Error('Brevo not loaded yet');
            }

            // Envoyer à Brevo
            window.Brevo.push(['track', eventData.event, eventData]);

            console.log('✅ Event tracked:', eventData.event, eventData);

        } catch (error) {
            console.warn('⚠️ Failed to send event to Brevo, storing locally:', error);

            // Sauvegarder dans localStorage
            this.eventQueue.push(eventData);
            localStorage.setItem('omnidesk_events', JSON.stringify(this.eventQueue));
        }
    }

    /**
     * Traite la queue d'événements sauvegardés
     */
    async processEventQueue() {
        if (this.eventQueue.length > 0 && typeof window.Brevo !== 'undefined') {
            const eventsToProcess = [...this.eventQueue];
            this.eventQueue = [];
            localStorage.removeItem('omnidesk_events');

            for (const event of eventsToProcess) {
                try {
                    window.Brevo.push(['track', event.event, event]);
                    console.log('✅ Queued event processed:', event.event);
                } catch (error) {
                    console.warn('⚠️ Failed to process queued event:', error);
                    this.eventQueue.push(event);
                }
            }

            if (this.eventQueue.length > 0) {
                localStorage.setItem('omnidesk_events', JSON.stringify(this.eventQueue));
            }
        }
    }

    /**
     * Configuration des event listeners
     */
    setupEventListeners() {
        // Calculateur ROI
        this.setupCalculatorTracking();

        // Quiz priorités
        this.setupQuizTracking();

        // Formulaire
        this.setupFormTracking();

        // CTA
        this.setupCTATracking();

        // Scroll et engagement
        this.setupScrollTracking();

        // Retry queue processing when Brevo loads
        document.addEventListener('DOMContentLoaded', () => {
            const checkBrevo = setInterval(() => {
                if (typeof window.Brevo !== 'undefined') {
                    this.processEventQueue();
                    clearInterval(checkBrevo);
                }
            }, 1000);
        });
    }

    /**
     * Tracking de la vue de page initiale
     */
    trackPageView() {
        const eventData = {
            ...this.createBaseEvent('page_view'),
            referrer: document.referrer,
            user_agent: navigator.userAgent
        };

        this.sendEvent(eventData);
    }

    /**
     * CALCULATEUR ROI - Setup tracking
     */
    setupCalculatorTracking() {
        const calculatorInputs = document.querySelectorAll('#emails, #time, #cost');
        const calculateButton = document.querySelector('.calculate-button');

        // Démarrage interaction calculateur
        calculatorInputs.forEach(input => {
            input.addEventListener('focus', () => {
                if (!this.calculatorTouched) {
                    this.calculatorTouched = true;
                    this.calculatorStartTime = Date.now();

                    const eventData = {
                        ...this.createBaseEvent('roi_calculator_started'),
                        default_values: {
                            emails_per_week: document.getElementById('emails').value,
                            minutes_per_email: document.getElementById('time').value,
                            hourly_cost: document.getElementById('cost').value
                        }
                    };

                    this.sendEvent(eventData);
                }
            });
        });

        // Calcul du ROI
        if (calculateButton) {
            calculateButton.addEventListener('click', () => {
                const timeSpent = this.calculatorStartTime ?
                    Math.round((Date.now() - this.calculatorStartTime) / 1000) : 0;

                const eventData = {
                    ...this.createBaseEvent('roi_calculator_completed'),
                    inputs: {
                        emails_per_week: parseInt(document.getElementById('emails').value) || 0,
                        minutes_per_email: parseInt(document.getElementById('time').value) || 0,
                        hourly_cost: parseInt(document.getElementById('cost').value) || 0
                    },
                    results: this.extractROIResults(),
                    time_spent_seconds: timeSpent
                };

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

                    const questionNumber = index + 1;
                    const eventData = {
                        ...this.createBaseEvent('quiz_interaction'),
                        question_number: questionNumber,
                        question_name: input.name,
                        selected_value: input.value,
                        selected_text: this.getRadioButtonText(input),
                        total_questions_answered: this.getAnsweredQuestionsCount()
                    };

                    this.sendEvent(eventData);

                    // Vérifier si le quiz est complet
                    if (this.isQuizCompleted()) {
                        this.trackQuizCompletion();
                    }
                });
            });
        });
    }

    /**
     * Récupère le texte associé à un radio button
     */
    getRadioButtonText(input) {
        const label = input.closest('label');
        if (label) {
            const spans = label.querySelectorAll('span:not(.radio-button)');
            return spans.length > 0 ? spans[0].textContent.trim() : '';
        }
        return '';
    }

    /**
     * Compte le nombre de questions répondues
     */
    getAnsweredQuestionsCount() {
        const questionNames = ['DEFIS_COMMUNICATION_ACTUELS', 'FONCTIONNALITES_PRIORITAIRES', 'OBJECTIFS_BUSINESS'];
        return questionNames.filter(name =>
            document.querySelector(`input[name="${name}"]:checked`)
        ).length;
    }

    /**
     * Vérifie si le quiz est complet
     */
    isQuizCompleted() {
        return this.getAnsweredQuestionsCount() === 3;
    }

    /**
     * Track completion du quiz
     */
    trackQuizCompletion() {
        const timeSpent = this.quizStartTime ?
            Math.round((Date.now() - this.quizStartTime) / 1000) : 0;

        const eventData = {
            ...this.createBaseEvent('quiz_completed'),
            selected_priorities: this.getAllQuizAnswers(),
            completion_time_seconds: timeSpent
        };

        this.sendEvent(eventData);
    }

    /**
     * Récupère toutes les réponses du quiz
     */
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

        // Tracking des interactions avec les champs
        formFields.forEach(field => {
            // Focus sur un champ
            field.addEventListener('focus', () => {
                if (!this.formStarted) {
                    this.formStarted = true;
                }

                fieldOrder++;

                const eventData = {
                    ...this.createBaseEvent('form_field_interaction'),
                    field_name: field.name || field.id,
                    field_type: field.type,
                    field_order: fieldOrder,
                    completion_percentage: this.getFormCompletionPercentage()
                };

                this.sendEvent(eventData);
            });

            // Progression du formulaire
            field.addEventListener('blur', () => {
                if (field.value.trim() !== '') {
                    const eventData = {
                        ...this.createBaseEvent('form_progress'),
                        field_name: field.name || field.id,
                        completion_percentage: this.getFormCompletionPercentage(),
                        filled_fields: this.getFilledFieldsCount(),
                        total_fields: formFields.length
                    };

                    this.sendEvent(eventData);
                }
            });

            // Identification utilisateur par email
            if (field.name === 'EMAIL' || field.type === 'email') {
                field.addEventListener('blur', () => {
                    if (this.isValidEmail(field.value)) {
                        this.identifyUser(field.value);
                    }
                });
            }
        });

        // Soumission du formulaire
        form.addEventListener('submit', () => {
            const eventData = {
                ...this.createBaseEvent('form_submitted'),
                completion_percentage: 100,
                total_time_seconds: Math.round((Date.now() - this.startTime) / 1000),
                source_context: this.getFormSourceContext()
            };

            this.sendEvent(eventData);
        });

        // Abandon du formulaire (détection via visibilitychange)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.formStarted && this.getFormCompletionPercentage() < 100) {
                const eventData = {
                    ...this.createBaseEvent('form_abandoned'),
                    completion_percentage: this.getFormCompletionPercentage(),
                    last_field: this.getLastFilledField(),
                    time_spent_seconds: Math.round((Date.now() - this.startTime) / 1000)
                };

                this.sendEvent(eventData);
            }
        });
    }

    /**
     * Calcule le pourcentage de completion du formulaire
     */
    getFormCompletionPercentage() {
        const form = document.getElementById('sib-form');
        if (!form) return 0;

        const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
        const filledRequiredFields = Array.from(requiredFields).filter(field =>
            field.value.trim() !== ''
        );

        return Math.round((filledRequiredFields.length / requiredFields.length) * 100);
    }

    /**
     * Compte les champs remplis
     */
    getFilledFieldsCount() {
        const form = document.getElementById('sib-form');
        if (!form) return 0;

        const fields = form.querySelectorAll('input, select, textarea');
        return Array.from(fields).filter(field => field.value.trim() !== '').length;
    }

    /**
     * Détermine le contexte source du formulaire
     */
    getFormSourceContext() {
        return {
            after_calculator: this.calculatorTouched,
            after_quiz: this.quizStartTime !== null,
            quiz_completed: this.isQuizCompleted()
        };
    }

    /**
     * Récupère le dernier champ rempli
     */
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

    /**
     * Validation email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Identifie l'utilisateur
     */
    identifyUser(email) {
        if (this.identifiedUser !== email) {
            this.identifiedUser = email;

            // Identifier dans Brevo
            if (typeof window.Brevo !== 'undefined') {
                window.Brevo.push(['identify', { email: email }]);
            }

            const eventData = {
                ...this.createBaseEvent('user_identified'),
                email: email,
                identification_context: this.getIdentificationContext()
            };

            this.sendEvent(eventData);
        }
    }

    /**
     * Contexte d'identification
     */
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
        // Bouton principal du formulaire
        const mainCTA = document.querySelector('.sib-form-block__button');

        if (mainCTA) {
            mainCTA.addEventListener('click', () => {
                const eventData = {
                    ...this.createBaseEvent('cta_clicked'),
                    cta_text: mainCTA.textContent.trim(),
                    cta_type: 'form_submit',
                    context: this.getCTAContext(),
                    scroll_position: Math.round(window.scrollY),
                    time_since_arrival: Math.round((Date.now() - this.startTime) / 1000)
                };

                this.sendEvent(eventData);
            });
        }

        // Bouton calculateur
        const calcButton = document.querySelector('.calculate-button');
        if (calcButton) {
            calcButton.addEventListener('click', () => {
                const eventData = {
                    ...this.createBaseEvent('cta_clicked'),
                    cta_text: calcButton.textContent.trim(),
                    cta_type: 'roi_calculator',
                    context: this.getCTAContext(),
                    scroll_position: Math.round(window.scrollY),
                    time_since_arrival: Math.round((Date.now() - this.startTime) / 1000)
                };

                this.sendEvent(eventData);
            });
        }
    }

    /**
     * Contexte du CTA
     */
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
        // Tracking toutes les 30 secondes
        this.engagementTimer = setInterval(() => {
            const eventData = {
                ...this.createBaseEvent('page_engagement'),
                total_time_seconds: Math.round((Date.now() - this.startTime) / 1000),
                scroll_depth_percentage: this.scrollDepth,
                sections_viewed: Array.from(this.sectionsViewed),
                interactions: {
                    calculator_touched: this.calculatorTouched,
                    quiz_answers: this.getAnsweredQuestionsCount(),
                    form_progress: this.getFormCompletionPercentage()
                }
            };

            this.sendEvent(eventData);
        }, 30000); // 30 secondes
    }

    /**
     * Setup scroll tracking
     */
    setupScrollTracking() {
        let ticking = false;

        const updateScrollDepth = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = Math.round((scrollTop / docHeight) * 100);

            this.scrollDepth = Math.max(this.scrollDepth, scrollPercent);

            // Détecter les sections vues
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

    /**
     * Détecte les sections visibles
     */
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
     * Nettoyage à la fermeture
     */
    cleanup() {
        if (this.engagementTimer) {
            clearInterval(this.engagementTimer);
        }
    }
}

// Initialisation automatique
let omniDeskTracker = null;

document.addEventListener('DOMContentLoaded', function() {
    omniDeskTracker = new OmniDeskTracker();

    // Nettoyage avant fermeture
    window.addEventListener('beforeunload', () => {
        if (omniDeskTracker) {
            omniDeskTracker.cleanup();
        }
    });
});

// Export pour utilisation externe si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OmniDeskTracker;
}