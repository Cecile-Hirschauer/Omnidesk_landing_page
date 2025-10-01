// ============================================
// OMNIDESK - MAIN.JS VERSION SIMPLIFIÉE
// ============================================

// Configuration Brevo (inchangé)
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
// CALCULATEUR ROI (inchangé)
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
// GESTION FORMULAIRE - VERSION ULTRA-SIMPLIFIÉE
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    calculateROI();

    // Event listeners ROI
    const roiInputs = ['emails', 'time', 'cost'];
    roiInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', calculateROI);
            input.addEventListener('change', calculateROI);
        }
    });

    initPostalCodeAutocomplete();

    // ============================================
    // INTERCEPTER SOUMISSION (pour n8n uniquement)
    // ============================================

    const sibForm = document.getElementById('sib-form');
    let formAlreadySubmitted = false;

    if (sibForm) {
        sibForm.addEventListener('submit', function (e) {

            // Éviter double soumission
            if (formAlreadySubmitted) {
                console.log('⚠️ Formulaire déjà soumis');
                return;
            }

            console.log('📤 Formulaire en cours de soumission...');
            formAlreadySubmitted = true;

            // ✅ Collecter les données du formulaire
            const formData = new FormData(sibForm);
            const formObject = {};

            for (let [key, value] of formData.entries()) {
                if (key !== 'email_address_check' && key !== 'locale' && key !== 'html_type') {
                    formObject[key] = value;
                }
            }

            // Calcul ROI
            const emailsPerWeek = parseInt(document.getElementById('emails').value) || 100;
            const minutesPerEmail = parseInt(document.getElementById('time').value) || 5;
            const hourlyCost = parseInt(document.getElementById('cost').value) || 25;
            const emailsPerMonth = Math.round(emailsPerWeek * 4.33);
            const hoursPerMonth = (emailsPerWeek * minutesPerEmail * 0.8 / 60) * 4.33;
            const monthlySaving = Math.round(hoursPerMonth * hourlyCost);
            let omniDeskPrice = emailsPerMonth < 200 ? 79 : emailsPerMonth < 600 ? 189 : 329;
            const netSaving = monthlySaving - omniDeskPrice;
            const roiPercent = omniDeskPrice > 0 ? Math.round((netSaving / omniDeskPrice) * 100) : 0;

            // Enrichir
            formObject.estimatedROI = roiPercent + '%';
            formObject.economiesMensuelles = netSaving;
            formObject.planSuggere = emailsPerMonth < 200 ? 'Starter' : emailsPerMonth < 600 ? 'Professional' : 'Enterprise';
            formObject.emailsPerMonth = emailsPerMonth;
            formObject.timestamp = new Date().toISOString();
            formObject.source = 'landing_page_omnidesk';

            // ============================================
            // ENVOI À N8N EN ARRIÈRE-PLAN (après 2 sec)
            // ============================================
            setTimeout(() => {
                fetch('https://n8n.j-aime.fr/webhook/omnidesk-form-pilote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formObject)
                })
                    .then(response => {
                        if (response.ok) {
                            console.log('✅ Données envoyées à n8n');
                        } else {
                            console.error('❌ Erreur n8n:', response.status);
                            // Sauvegarde locale
                            const failed = JSON.parse(localStorage.getItem('omnidesk_failed_submissions') || '[]');
                            failed.push({ data: formObject, timestamp: new Date().toISOString() });
                            localStorage.setItem('omnidesk_failed_submissions', JSON.stringify(failed));
                        }
                    })
                    .catch(error => {
                        console.error('❌ Erreur connexion n8n:', error);
                        // Sauvegarde locale
                        const failed = JSON.parse(localStorage.getItem('omnidesk_failed_submissions') || '[]');
                        failed.push({ data: formObject, timestamp: new Date().toISOString() });
                        localStorage.setItem('omnidesk_failed_submissions', JSON.stringify(failed));
                    });
            }, 2000); // Attendre 2 secondes après soumission Brevo

            // ✅ AFFICHER LE MESSAGE DE SUCCÈS (après 2.5 sec)
            setTimeout(() => {
                showSuccessMessage();
            }, 2500);
        });
    }
});

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
}

// ============================================
// RETRY AUTOMATIQUE DES SUBMISSIONS FAILED
// ============================================
async function retryFailedSubmissions() {
    const failedSubmissions = JSON.parse(localStorage.getItem('omnidesk_failed_submissions') || '[]');

    if (failedSubmissions.length > 0) {
        console.log(`🔄 Retry de ${failedSubmissions.length} soumission(s)`);

        const remaining = [];

        for (const submission of failedSubmissions) {
            try {
                const response = await fetch('https://n8n.j-aime.fr/webhook/omnidesk-form-pilote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submission.data)
                });

                if (response.ok) {
                    console.log('✅ Retry succès');
                } else {
                    remaining.push(submission);
                }
            } catch (error) {
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

document.addEventListener('DOMContentLoaded', retryFailedSubmissions);

// ============================================
// AUTOCOMPLÉTION CODE POSTAL (inchangé)
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

// Fonctions de test (pour debug)
window.testSuccessMessage = showSuccessMessage;