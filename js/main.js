// Configuration Brevo
window.REQUIRED_CODE_ERROR_MESSAGE = 'Please choose a country code';
window.LOCALE = 'fr';
window.EMAIL_INVALID_MESSAGE = window.SMS_INVALID_MESSAGE = "⚠️ Email invalide";
window.REQUIRED_ERROR_MESSAGE = "Ce champ est obligatoire";
window.GENERIC_INVALID_MESSAGE = "⚠️ Informations incomplètes";

window.translation = {
    common: {
        selectedList: '{quantity} list selected',
        selectedLists: '{quantity} lists selected',
        selectedOption: '{quantity} selected',
        selectedOptions: '{quantity} selected',
    }
};

var AUTOHIDE = Boolean(0);

function calculateROI() {
    // Récupération des valeurs avec parsing correct
    const emailsPerWeek = parseInt(document.getElementById('emails').value) || 100;
    const minutesPerEmail = parseInt(document.getElementById('time').value) || 5;
    const hourlyCost = parseInt(document.getElementById('cost').value) || 25;

    // Calcul du temps économisé (80% d'automatisation)
    const totalMinutesPerWeek = emailsPerWeek * minutesPerEmail;
    const minutesSavedPerWeek = totalMinutesPerWeek * 0.8; // 80% d'automatisation
    const hoursPerWeek = minutesSavedPerWeek / 60;

    // Calcul de l'économie mensuelle
    const hoursPerMonth = hoursPerWeek * 4.33; // Moyenne plus précise de semaines par mois
    const monthlySaving = Math.round(hoursPerMonth * hourlyCost);

    // Calcul du nombre d'emails par mois
    const emailsPerMonth = Math.round(emailsPerWeek * 4.33);

    // Déterminer le plan OmniDesk selon le volume d'emails/mois
    let planName, omniDeskPrice;
    if (emailsPerMonth < 200) {
        planName = "Starter";
        omniDeskPrice = 79;
    } else if (emailsPerMonth < 600) {
        planName = "Professional";
        omniDeskPrice = 189;
    } else {
        planName = "Enterprise";
        omniDeskPrice = 329;
    }

    // Calcul de l'économie nette et du ROI
    const netSaving = monthlySaving - omniDeskPrice;
    const roiPercent = omniDeskPrice > 0 ? Math.round((netSaving / omniDeskPrice) * 100) : 0;

    // Affichage des résultats avec formatage
    document.getElementById('timeSaved').textContent = hoursPerWeek.toFixed(1) + 'h/sem';
    document.getElementById('planRecommended').innerHTML = planName + '<br><span style="font-size: 12px;">' + omniDeskPrice + '€/mois</span>';
    document.getElementById('monthlySaving').textContent = netSaving.toLocaleString('fr-FR') + '€';
    document.getElementById('roiPercent').textContent = roiPercent + '%';

    // Afficher les résultats
    const resultsDiv = document.getElementById('roiResults');
    if (resultsDiv) {
        resultsDiv.style.display = 'block';

        // Animation des valeurs (uniquement si appelée par le bouton)
        if (arguments.length > 0 && arguments[0] === true) {
            setTimeout(() => {
                resultsDiv.style.opacity = '0';
                setTimeout(() => {
                    resultsDiv.style.opacity = '1';
                }, 50);
            }, 10);
        }
    }
}

// Fonction pour le bouton de recalcul avec animation
function recalculateROI() {
    calculateROI(true);
}

// Gérer l'affichage des champs "Autre"
document.addEventListener('DOMContentLoaded', function() {
    // Calcul initial avec valeurs par défaut
    calculateROI();

    // Ajouter des event listeners pour le calcul automatique du ROI
    const roiInputs = ['emails', 'time', 'cost'];
    roiInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', calculateROI);
            input.addEventListener('change', calculateROI);
        }
    });

    // Initialiser l'autocomplétion des villes par code postal
    initPostalCodeAutocomplete();

    // Gestion du PMS
    const pmsSelect = document.getElementById('pms-select');
    if (pmsSelect) {
        pmsSelect.addEventListener('change', function() {
            const autreField = document.getElementById('pms-autre');
            if (this.value === 'autre') {
                autreField.style.display = 'block';
                autreField.focus();
            } else {
                autreField.style.display = 'none';
                autreField.value = '';
            }
        });
    }

    // Gestion du Channel Manager
    const channelSelect = document.getElementById('channel-select');
    if (channelSelect) {
        channelSelect.addEventListener('change', function() {
            const autreField = document.getElementById('channel-autre');
            if (this.value === 'autre') {
                autreField.style.display = 'block';
                autreField.focus();
            } else {
                autreField.style.display = 'none';
                autreField.value = '';
            }
        });
    }

    // Gestion du Booking Engine
    const bookingSelect = document.getElementById('booking-select');
    if (bookingSelect) {
        bookingSelect.addEventListener('change', function() {
            const autreField = document.getElementById('booking-autre');
            if (this.value === 'autre') {
                autreField.style.display = 'block';
                autreField.focus();
            } else {
                autreField.style.display = 'none';
                autreField.value = '';
            }
        });
    }

    // Gestion de l'envoi du formulaire Brevo
    const sibForm = document.getElementById('sib-form');
    if (sibForm) {
        sibForm.addEventListener('submit', function(e) {
            console.log('Formulaire Brevo soumis');
            window.brevoFormSubmitted = true;

            // Collecter les données des questionnaires radio
            const defisComm = document.querySelector('input[name="DEFIS_COMMUNICATION_ACTUELS"]:checked');
            const fonctionnalites = document.querySelector('input[name="FONCTIONNALITES_PRIORITAIRES"]:checked');
            const objectifs = document.querySelector('input[name="OBJECTIFS_BUSINESS"]:checked');

            // Collecter les systèmes actuels
            const pmsValue = document.getElementById('PMS_ACTUEL') ? document.getElementById('PMS_ACTUEL').value : '';
            const bookingValue = document.getElementById('BOOKING_ENGINE') ? document.getElementById('BOOKING_ENGINE').value : '';
            const channelValue = document.getElementById('CHANNEL_MANAGER') ? document.getElementById('CHANNEL_MANAGER').value : '';

            // Calculer le ROI actuel
            const emailsPerWeek = parseInt(document.getElementById('emails').value) || 100;
            const minutesPerEmail = parseInt(document.getElementById('time').value) || 5;
            const hourlyCost = parseInt(document.getElementById('cost').value) || 25;
            const emailsPerMonth = Math.round(emailsPerWeek * 4.33);
            const hoursPerMonth = (emailsPerWeek * minutesPerEmail * 0.8 / 60) * 4.33;
            const monthlySaving = Math.round(hoursPerMonth * hourlyCost);
            let omniDeskPrice = emailsPerMonth < 200 ? 79 : emailsPerMonth < 600 ? 189 : 329;
            const netSaving = monthlySaving - omniDeskPrice;
            const roiPercent = omniDeskPrice > 0 ? Math.round((netSaving / omniDeskPrice) * 100) : 0;

            // Mettre à jour les champs cachés
            document.getElementById('hiddenPms').value = pmsValue;
            document.getElementById('hiddenBookingEngine').value = bookingValue;
            document.getElementById('hiddenChannelManager').value = channelValue;
            document.getElementById('hiddenROI').value = roiPercent + '%';

            // Log des données pour debug
            console.log('Données du formulaire Brevo:', {
                defis_communication: defisComm ? defisComm.value : null,
                fonctionnalites_prioritaires: fonctionnalites ? fonctionnalites.value : null,
                objectifs_business: objectifs ? objectifs.value : null,
                pms: pmsValue,
                booking_engine: bookingValue,
                channel_manager: channelValue,
                roi_estimé: roiPercent + '%'
            });

            // Attendre la soumission et surveiller pour le message de succès
            setTimeout(() => {
                checkForBrevoSuccess();
            }, 1000);
        });
    }

    // Fonction pour vérifier le succès Brevo après soumission
    function checkForBrevoSuccess() {
        let attempts = 0;
        const maxAttempts = 20; // 10 secondes maximum

        const checkInterval = setInterval(() => {
            attempts++;
            console.log(`Tentative ${attempts} de détection du succès Brevo`);

            // Vérifier si le formulaire a disparu ou si des éléments de succès sont présents
            const formContainer = document.getElementById('sib-container');
            const form = document.getElementById('sib-form');

            // Rechercher des éléments indicateurs de succès
            const successIndicators = document.querySelectorAll([
                '.sib-form-message-panel',
                '[class*="success"]',
                '[class*="confirmation"]',
                '[style*="display: block"]'
            ].join(','));

            let foundSuccess = false;

            // Vérifier le contenu des éléments pour des messages de succès
            successIndicators.forEach(element => {
                const text = element.textContent.toLowerCase();
                if (text.includes('merci') || text.includes('reçu') || text.includes('envoyé') ||
                    text.includes('success') || text.includes('confirmation') || text.includes('thank')) {
                    foundSuccess = true;
                    console.log('Message de succès trouvé dans:', element);
                }
            });

            // Vérifier si le formulaire est masqué (indication de succès)
            if (form && (form.style.display === 'none' || !form.offsetParent)) {
                foundSuccess = true;
                console.log('Formulaire masqué, probablement soumis avec succès');
            }

            if (foundSuccess) {
                console.log('Succès détecté, affichage du message personnalisé');
                showSuccessMessage();
                clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
                console.log('Timeout: impossible de détecter le succès Brevo');
                clearInterval(checkInterval);
            }
        }, 500);
    }

    // Écouter les messages de succès de Brevo (plusieurs méthodes)
    window.addEventListener('message', function(event) {
        if (event.data && (event.data.type === 'sib-form-success' || event.data === 'sib-form-success')) {
            showSuccessMessage();
        }
    });

    // Variables globales pour tracker les soumissions
    window.brevoFormSubmitted = false;
    window.brevoButtonClicked = false;

    // Observer les changements dans le DOM SEULEMENT après soumission
    const observer = new MutationObserver(function(mutations) {
        // Ne pas agir si le formulaire n'a pas été soumis
        if (!window.brevoFormSubmitted && !window.brevoButtonClicked) {
            return;
        }

        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    // Rechercher spécifiquement des éléments de succès Brevo
                    const brevoSuccessSelectors = [
                        '.sib-form-message-panel__success',
                        '.sib-form-message-panel--success',
                        '.sib-success-message'
                    ];

                    let isBrevoSuccess = false;

                    // Vérifier le noeud lui-même
                    brevoSuccessSelectors.forEach(selector => {
                        try {
                            if (node.matches && node.matches(selector)) {
                                isBrevoSuccess = true;
                            }
                        } catch (e) {}
                    });

                    // Vérifier les enfants du noeud
                    if (node.querySelectorAll) {
                        brevoSuccessSelectors.forEach(selector => {
                            try {
                                if (node.querySelectorAll(selector).length > 0) {
                                    isBrevoSuccess = true;
                                }
                            } catch (e) {}
                        });
                    }

                    // Vérifier le contenu textuel SEULEMENT pour des éléments Brevo
                    if (node.className && node.className.includes('sib-') && node.textContent) {
                        const successText = ['merci', 'success', 'confirmation', 'envoyé'];
                        const nodeText = node.textContent.toLowerCase();
                        if (successText.some(text => nodeText.includes(text))) {
                            isBrevoSuccess = true;
                        }
                    }

                    if (isBrevoSuccess) {
                        console.log('Message de succès Brevo détecté via Observer:', node);
                        setTimeout(showSuccessMessage, 500);
                    }
                }
            });
        });
    });

    // Observer uniquement le conteneur du formulaire Brevo
    const sibContainer = document.getElementById('sib-container');
    if (sibContainer) {
        observer.observe(sibContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    // Surveiller les clics sur le bouton de soumission
    const submitButton = document.querySelector('.sib-form-block__button');
    if (submitButton) {
        submitButton.addEventListener('click', function(e) {
            console.log('Bouton de soumission Brevo cliqué');
            window.brevoButtonClicked = true;

            // Attendre la soumission et vérifier le succès
            setTimeout(() => {
                checkForBrevoSuccessAfterClick();
            }, 2000); // Attendre 2 secondes pour la réponse du serveur
        });
    }

    // Fonction spécifique pour vérifier après un clic sur le bouton
    function checkForBrevoSuccessAfterClick() {
        let attempts = 0;
        const maxAttempts = 15; // 7.5 secondes maximum

        const checkInterval = setInterval(() => {
            attempts++;
            console.log(`Vérification post-clic ${attempts}`);

            // Chercher tous les éléments qui pourraient contenir un message de succès
            const allElements = document.querySelectorAll('*');
            let successFound = false;

            allElements.forEach(element => {
                const text = element.textContent?.toLowerCase() || '';
                const className = element.className?.toLowerCase() || '';

                // Mots-clés de succès plus larges
                const successKeywords = [
                    'merci', 'thank you', 'reçu', 'envoyé', 'sent', 'received',
                    'success', 'confirmation', 'confirmé', 'validated', 'validé',
                    'registered', 'inscription', 'enregistré'
                ];

                const successClassKeywords = ['success', 'confirm', 'valid'];

                // Vérifier le texte
                const hasSuccessText = successKeywords.some(keyword => text.includes(keyword));

                // Vérifier les classes
                const hasSuccessClass = successClassKeywords.some(keyword => className.includes(keyword));

                if ((hasSuccessText || hasSuccessClass) && element.offsetParent !== null) {
                    console.log('Élément de succès détecté:', element, 'Texte:', text.substring(0, 100));
                    successFound = true;
                }
            });

            if (successFound) {
                console.log('Succès confirmé après clic, affichage du message');
                showSuccessMessage();
                clearInterval(checkInterval);
            } else if (attempts >= maxAttempts) {
                console.log('Timeout après clic sur le bouton');
                clearInterval(checkInterval);
            }
        }, 500);
    }

    // Variables pour s'assurer qu'on ne se déclenche que lors d'une vraie soumission
    let formSubmitted = false;
    let buttonClicked = false;

    // Ces variables sont maintenant gérées globalement plus haut

    // Vérification périodique SEULEMENT si le formulaire a été soumis
    let checkCount = 0;
    const checkForSuccess = setInterval(() => {
        checkCount++;

        // Ne vérifier que si le formulaire a été vraiment soumis
        if (!window.brevoFormSubmitted && !window.brevoButtonClicked) {
            if (checkCount > 60) { // Arrêter après 30 secondes
                clearInterval(checkForSuccess);
            }
            return;
        }

        // Chercher spécifiquement des éléments de succès Brevo dynamiques
        const brevoSuccessElements = document.querySelectorAll([
            '.sib-form-message-panel__success',
            '.sib-form-message-panel--success',
            '.sib-form-message-panel[style*="display: block"]'
        ].join(','));

        let foundBrevoSuccess = false;

        brevoSuccessElements.forEach(el => {
            if (el.offsetParent !== null) {
                const text = el.textContent.toLowerCase();
                const successKeywords = ['merci', 'reçu', 'envoyé', 'success', 'confirmation'];

                if (successKeywords.some(keyword => text.includes(keyword))) {
                    console.log('Message de succès Brevo détecté:', el);
                    foundBrevoSuccess = true;
                }
            }
        });

        if (foundBrevoSuccess) {
            console.log('Succès Brevo confirmé après soumission');
            showSuccessMessage();
            clearInterval(checkForSuccess);
        } else if (checkCount > 60) { // Arrêter après 30 secondes
            console.log('Timeout: pas de message de succès Brevo détecté');
            clearInterval(checkForSuccess);
        }
    }, 500);
});

// Fonction pour afficher le message de succès
function showSuccessMessage() {
    const successMessage = document.getElementById('success-message');
    const formContainer = document.getElementById('sib-container');

    if (successMessage) {
        // Éviter les doublons
        if (successMessage.style.display === 'block') {
            console.log('Message de succès déjà affiché');
            return;
        }

        // Masquer le formulaire si présent
        if (formContainer) {
            formContainer.style.display = 'none';
        }

        // Afficher le message de succès avec animation
        successMessage.style.display = 'block';
        successMessage.style.opacity = '0';
        successMessage.style.transform = 'translateY(20px)';
        successMessage.style.transition = 'all 0.5s ease';

        // Animation d'apparition
        setTimeout(() => {
            successMessage.style.opacity = '1';
            successMessage.style.transform = 'translateY(0)';
        }, 50);

        // Scroll vers le message
        successMessage.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        console.log('Message de succès affiché avec succès');
    } else {
        console.error('Element success-message non trouvé');
    }
}

// Fonction de test pour déclencher manuellement le message (pour debug)
window.testSuccessMessage = function() {
    console.log('Test du message de succès déclenché');
    showSuccessMessage();
};

// Fonction de debug pour forcer l'affichage après 5 secondes (pour test)
window.forceSuccessAfterDelay = function(seconds = 5) {
    console.log(`Message de succès forcé dans ${seconds} secondes`);
    setTimeout(() => {
        console.log('Affichage forcé du message de succès');
        showSuccessMessage();
    }, seconds * 1000);
};

// Ajouter un gestionnaire global pour intercepter les soumissions AJAX (SEULEMENT après soumission)
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        console.log('Fetch intercepté:', args[0]);
        return originalFetch.apply(this, args).then(response => {
            if (response.ok && args[0] && args[0].includes('brevo') &&
                (window.brevoFormSubmitted || window.brevoButtonClicked)) {
                console.log('Réponse Brevo réussie détectée via fetch après soumission');
                setTimeout(showSuccessMessage, 1000);
            }
            return response;
        });
    };

    const originalXHR = window.XMLHttpRequest;
    function newXHR() {
        const xhr = new originalXHR();
        const originalSend = xhr.send;
        xhr.send = function(...args) {
            console.log('XHR envoyé:', xhr);
            xhr.addEventListener('load', function() {
                if (xhr.status >= 200 && xhr.status < 300 &&
                    (window.brevoFormSubmitted || window.brevoButtonClicked)) {
                    console.log('Réponse XHR réussie:', xhr.responseURL);
                    if (xhr.responseURL && (xhr.responseURL.includes('brevo') || xhr.responseURL.includes('sendinblue'))) {
                        console.log('Réponse Brevo réussie détectée via XHR après soumission');
                        setTimeout(showSuccessMessage, 1000);
                    }
                }
            });
            return originalSend.apply(this, args);
        };
        return xhr;
    }
    window.XMLHttpRequest = newXHR;
})();

// Pour tester dans la console:
// testSuccessMessage() - affichage immédiat
// forceSuccessAfterDelay(3) - affichage après 3 secondes

// Fonctionnalité d'autocomplétion des villes par code postal
async function fetchCitiesByPostalCode(postalCode) {
    try {
        const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom&format=json&geometry=centre`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.map(commune => commune.nom).sort();
    } catch (error) {
        console.warn('Erreur lors de la récupération des villes:', error);
        return [];
    }
}

function showLoadingState(villeField) {
    villeField.style.opacity = '0.7';
    villeField.value = 'Chargement des villes...';
    villeField.disabled = true;

    // Ajouter la classe de chargement au conteneur parent
    const parentDiv = villeField.closest('.entry__field');
    if (parentDiv) {
        parentDiv.classList.add('loading-postal');
    }
}

function hideLoadingState(villeField) {
    villeField.style.opacity = '1';
    villeField.disabled = false;

    // Retirer la classe de chargement
    const parentDiv = villeField.closest('.entry__field');
    if (parentDiv) {
        parentDiv.classList.remove('loading-postal');
    }
}

function createCitySelect(cities, originalField) {
    const select = document.createElement('select');
    select.className = originalField.className;
    select.id = originalField.id;
    select.name = originalField.name;
    select.required = originalField.required;

    // Option par défaut
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Sélectionnez votre ville';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    // Ajouter les villes
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        select.appendChild(option);
    });

    return select;
}

function restoreCityInput(selectField) {
    const input = document.createElement('input');
    input.className = selectField.className;
    input.id = selectField.id;
    input.name = selectField.name;
    input.type = 'text';
    input.required = selectField.required;
    input.maxLength = '200';
    input.autocomplete = 'off';
    input.setAttribute('data-required', 'true');

    return input;
}

async function handlePostalCodeChange(event) {
    const postalCode = event.target.value.trim();
    const villeField = document.getElementById('VILLE');

    if (!villeField) return;

    // Validation du code postal français (5 chiffres)
    const postalCodeRegex = /^[0-9]{5}$/;

    if (!postalCodeRegex.test(postalCode)) {
        // Si le code postal n'est pas valide et qu'on a un select, le remettre en input
        if (villeField.tagName === 'SELECT') {
            const newInput = restoreCityInput(villeField);
            villeField.parentNode.replaceChild(newInput, villeField);
        } else {
            villeField.value = '';
        }
        return;
    }

    // Afficher l'état de chargement
    showLoadingState(villeField);

    try {
        const cities = await fetchCitiesByPostalCode(postalCode);

        hideLoadingState(villeField);

        if (cities.length === 0) {
            // Aucune ville trouvée
            if (villeField.tagName === 'SELECT') {
                const newInput = restoreCityInput(villeField);
                villeField.parentNode.replaceChild(newInput, villeField);
            } else {
                villeField.value = '';
            }
        } else if (cities.length === 1) {
            // Une seule ville
            if (villeField.tagName === 'SELECT') {
                const newInput = restoreCityInput(villeField);
                newInput.value = cities[0];
                villeField.parentNode.replaceChild(newInput, villeField);
            } else {
                villeField.value = cities[0];
            }
        } else {
            // Plusieurs villes - créer un select
            const select = createCitySelect(cities, villeField);
            villeField.parentNode.replaceChild(select, villeField);
        }
    } catch (error) {
        hideLoadingState(villeField);
        console.error('Erreur lors de la mise à jour de la ville:', error);
    }
}

// Initialiser la fonctionnalité d'autocomplétion
function initPostalCodeAutocomplete() {
    const postalCodeField = document.getElementById('CODE_POSTAL');

    if (postalCodeField) {
        // Utiliser 'input' au lieu de 'keyup' pour une réactivité optimale
        postalCodeField.addEventListener('input', debounce(handlePostalCodeChange, 500));
    }
}

// Fonction utilitaire de debounce pour éviter trop d'appels API
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

