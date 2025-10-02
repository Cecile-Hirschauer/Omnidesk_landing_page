// ============================================
// OMNIDESK - MAIN.JS CORRIGÉ
// Envoi direct des données à n8n
// ============================================

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

// ============================================
// CALCULATEUR ROI
// ============================================
function calculateROI() {
    const emailsPerWeek = parseInt(document.getElementById('emails').value) || 100;
    const minutesPerEmail = parseInt(document.getElementById('time').value) || 5;
    const hourlyCost = parseInt(document.getElementById('cost').value) || 25;

    const totalMinutesPerWeek = emailsPerWeek * minutesPerEmail;
    const minutesSavedPerWeek = totalMinutesPerWeek * 0.8;
    const hoursPerWeek = minutesSavedPerWeek / 60;

    const hoursPerMonth = hoursPerWeek * 4.33;
    const monthlySaving = Math.round(hoursPerMonth * hourlyCost);

    const emailsPerMonth = Math.round(emailsPerWeek * 4.33);

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

    const netSaving = monthlySaving - omniDeskPrice;
    const roiPercent = omniDeskPrice > 0 ? Math.round((netSaving / omniDeskPrice) * 100) : 0;

    document.getElementById('timeSaved').textContent = hoursPerWeek.toFixed(1) + 'h/sem';
    document.getElementById('planRecommended').innerHTML = planName + '<br><span style="font-size: 12px;">' + omniDeskPrice + '€/mois</span>';
    document.getElementById('monthlySaving').textContent = netSaving.toLocaleString('fr-FR') + '€';
    document.getElementById('roiPercent').textContent = roiPercent + '%';

    const resultsDiv = document.getElementById('roiResults');
    if (resultsDiv) {
        resultsDiv.style.display = 'block';

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

function recalculateROI() {
    calculateROI(true);
}

// ============================================
// COLLECTE DES DONNÉES DU FORMULAIRE
// ============================================
function collectFormData(form) {
    const formData = new FormData(form);
    const formObject = {};

    // Collecter tous les champs sauf les champs système
    for (let [key, value] of formData.entries()) {
        if (key !== 'email_address_check' && key !== 'locale' && key !== 'html_type') {
            formObject[key] = value;
        }
    }

    // Ajouter les données ROI
    const emailsPerWeek = parseInt(document.getElementById('emails').value) || 100;
    const minutesPerEmail = parseInt(document.getElementById('time').value) || 5;
    const hourlyCost = parseInt(document.getElementById('cost').value) || 25;
    const emailsPerMonth = Math.round(emailsPerWeek * 4.33);
    const hoursPerMonth = (emailsPerWeek * minutesPerEmail * 0.8 / 60) * 4.33;
    const monthlySaving = Math.round(hoursPerMonth * hourlyCost);
    let omniDeskPrice = emailsPerMonth < 200 ? 79 : emailsPerMonth < 600 ? 189 : 329;
    const netSaving = monthlySaving - omniDeskPrice;
    const roiPercent = omniDeskPrice > 0 ? Math.round((netSaving / omniDeskPrice) * 100) : 0;

    // Enrichir les données
    formObject.estimatedROI = roiPercent + '%';
    formObject.economiesMensuelles = netSaving;
    formObject.planSuggere = emailsPerMonth < 200 ? 'Starter' : emailsPerMonth < 600 ? 'Professional' : 'Enterprise';
    formObject.emailsPerMonth = emailsPerMonth;
    formObject.timestamp = new Date().toISOString();
    formObject.source = 'landing_page_omnidesk';

    console.log('📦 Données collectées:', formObject);

    return formObject;
}

// ============================================
// ENVOI À N8N
// ============================================
async function sendToN8n(formData) {
    const n8nUrl = 'https://n8n.j-aime.fr/webhook/omnidesk-lead-process_v3';

    try {
        console.log('📤 Envoi à n8n...', n8nUrl);

        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            console.log('✅ Données envoyées à n8n avec succès');
            return { success: true };
        } else {
            console.error('❌ Erreur n8n:', response.status, await response.text());
            return { success: false, error: 'HTTP ' + response.status };
        }

    } catch (error) {
        console.error('❌ Erreur connexion n8n:', error);

        // Sauvegarder localement en cas d'échec
        const failed = JSON.parse(localStorage.getItem('omnidesk_failed_submissions') || '[]');
        failed.push({
            data: formData,
            timestamp: new Date().toISOString(),
            error: error.message
        });
        localStorage.setItem('omnidesk_failed_submissions', JSON.stringify(failed));

        return { success: false, error: error.message };
    }
}

// ============================================
// ENVOI À BREVO (optionnel, après n8n)
// ============================================
async function sendToBrevo(form) {
    try {
        const formData = new FormData(form);

        console.log('📤 Envoi à Brevo...');

        const response = await fetch(form.action, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            console.log('✅ Données envoyées à Brevo');
            return { success: true };
        } else {
            console.warn('⚠️ Erreur Brevo:', response.status);
            return { success: false };
        }

    } catch (error) {
        console.warn('⚠️ Erreur connexion Brevo:', error);
        return { success: false };
    }
}

// ============================================
// GESTION DE LA SOUMISSION
// ============================================
let formSubmitting = false;

async function handleFormSubmit(event) {
    event.preventDefault(); // ⚠️ IMPORTANT : Empêcher la soumission par défaut

    // Éviter double soumission
    if (formSubmitting) {
        console.log('⚠️ Soumission déjà en cours');
        return;
    }

    formSubmitting = true;
    const form = event.target;

    console.log('🚀 Début de la soumission du formulaire');

    // Désactiver le bouton
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span>Envoi en cours...</span>';
    }

    try {
        // 1. Collecter les données
        const formData = collectFormData(form);

        // 2. Envoyer à n8n (PRIORITAIRE)
        const n8nResult = await sendToN8n(formData);

        if (n8nResult.success) {
            console.log('✅ n8n OK');
        } else {
            console.warn('⚠️ n8n KO mais on continue');
        }

        // 3. Envoyer à Brevo (optionnel, en arrière-plan)
        sendToBrevo(form).then(result => {
            if (result.success) {
                console.log('✅ Brevo OK');
            } else {
                console.warn('⚠️ Brevo KO');
            }
        });

        // 4. Afficher le message de succès
        setTimeout(() => {
            showSuccessMessage();
        }, 1000);

    } catch (error) {
        console.error('❌ Erreur soumission:', error);

        // Afficher un message d'erreur
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.style.display = 'block';
        }

        // Réactiver le bouton
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Je réserve ma place Pilote';
        }

        formSubmitting = false;
    }
}

// ============================================
// MESSAGE DE SUCCÈS
// ============================================
function showSuccessMessage() {
    const successMessage = document.getElementById('success-message');
    const formContainer = document.getElementById('sib-container');

    if (successMessage) {
        if (successMessage.style.display === 'block') {
            return;
        }

        if (formContainer) {
            formContainer.style.display = 'none';
        }

        successMessage.style.display = 'block';
        successMessage.style.opacity = '0';
        successMessage.style.transform = 'translateY(20px)';
        successMessage.style.transition = 'all 0.5s ease';

        setTimeout(() => {
            successMessage.style.opacity = '1';
            successMessage.style.transform = 'translateY(0)';
        }, 50);

        successMessage.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        console.log('✅ Message de succès affiché');
    }

    formSubmitting = false;
}

// ============================================
// RETRY AUTOMATIQUE
// ============================================
async function retryFailedSubmissions() {
    const failedSubmissions = JSON.parse(localStorage.getItem('omnidesk_failed_submissions') || '[]');

    if (failedSubmissions.length > 0) {
        console.log(`🔄 Retry de ${failedSubmissions.length} soumission(s)`);

        const remaining = [];

        for (const submission of failedSubmissions) {
            const result = await sendToN8n(submission.data);

            if (!result.success) {
                remaining.push(submission);
            }
        }

        if (remaining.length > 0) {
            localStorage.setItem('omnidesk_failed_submissions', JSON.stringify(remaining));
        } else {
            localStorage.removeItem('omnidesk_failed_submissions');
            console.log('✅ Tous les retries réussis');
        }
    }
}

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    // ROI Calculator
    calculateROI();

    const roiInputs = ['emails', 'time', 'cost'];
    roiInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', calculateROI);
            input.addEventListener('change', calculateROI);
        }
    });

    // Postal Code Autocomplete
    initPostalCodeAutocomplete();

    // ⚠️ INTERCEPTER LA SOUMISSION DU FORMULAIRE
    const sibForm = document.getElementById('sib-form');
    if (sibForm) {
        sibForm.addEventListener('submit', handleFormSubmit);
        console.log('✅ Handler de soumission installé');
    } else {
        console.error('❌ Formulaire #sib-form introuvable');
    }

    // Retry des soumissions échouées
    retryFailedSubmissions();
});

// ============================================
// AUTOCOMPLÉTION CODE POSTAL
// ============================================
async function fetchCitiesByPostalCode(postalCode) {
    try {
        const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom&format=json&geometry=centre`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.map(commune => commune.nom).sort();
    } catch (error) {
        console.warn('Erreur récupération villes:', error);
        return [];
    }
}

function showLoadingState(villeField) {
    villeField.style.opacity = '0.7';
    villeField.value = 'Chargement des villes...';
    villeField.disabled = true;
    const parentDiv = villeField.closest('.entry__field');
    if (parentDiv) parentDiv.classList.add('loading-postal');
}

function hideLoadingState(villeField) {
    villeField.style.opacity = '1';
    villeField.disabled = false;
    const parentDiv = villeField.closest('.entry__field');
    if (parentDiv) parentDiv.classList.remove('loading-postal');
}

function createCitySelect(cities, originalField) {
    const select = document.createElement('select');
    select.className = originalField.className;
    select.id = originalField.id;
    select.name = originalField.name;
    select.required = originalField.required;

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Sélectionnez votre ville';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

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

    const postalCodeRegex = /^[0-9]{5}$/;

    if (!postalCodeRegex.test(postalCode)) {
        if (villeField.tagName === 'SELECT') {
            const newInput = restoreCityInput(villeField);
            villeField.parentNode.replaceChild(newInput, villeField);
        } else {
            villeField.value = '';
        }
        return;
    }

    showLoadingState(villeField);

    try {
        const cities = await fetchCitiesByPostalCode(postalCode);
        hideLoadingState(villeField);

        if (cities.length === 0) {
            if (villeField.tagName === 'SELECT') {
                const newInput = restoreCityInput(villeField);
                villeField.parentNode.replaceChild(newInput, villeField);
            } else {
                villeField.value = '';
            }
        } else if (cities.length === 1) {
            if (villeField.tagName === 'SELECT') {
                const newInput = restoreCityInput(villeField);
                newInput.value = cities[0];
                villeField.parentNode.replaceChild(newInput, villeField);
            } else {
                villeField.value = cities[0];
            }
        } else {
            const select = createCitySelect(cities, villeField);
            villeField.parentNode.replaceChild(select, villeField);
        }
    } catch (error) {
        hideLoadingState(villeField);
        console.error('Erreur mise à jour ville:', error);
    }
}

function initPostalCodeAutocomplete() {
    const postalCodeField = document.getElementById('CODE_POSTAL');
    if (postalCodeField) {
        postalCodeField.addEventListener('input', debounce(handlePostalCodeChange, 500));
    }
}

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

// Fonctions de test
window.testSuccessMessage = showSuccessMessage;
window.testRetry = retryFailedSubmissions;