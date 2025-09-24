
// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function() {

    // Setup button click handlers
    const buttonHandlers = {
        'btn-addEventListener-attack': simulateAddEventListenerAttack,
        'btn-addEventListener-clear': () => clearConsole('addEventListener-console'),
        'btn-eventHandler-attack': simulateEventHandlerAttack,
        'btn-eventHandler-clear': () => clearConsole('eventHandler-console'),
        'btn-propertyGetter-attack': simulatePropertyGetterAttack,
        'btn-propertyGetter-clear': () => clearConsole('propertyGetter-console'),
        'btn-formHooks-attack': simulateFormHooksAttack,
        'btn-formSubmit-attack': simulateFormSubmitAttack,
        'btn-form-submit-event': simulateFormSubmissionEvent,
        'btn-formHooks-clear': () => clearConsole('formHooks-console'),
        'btn-crossFrame-clear': () => clearConsole('cross-frame-console')
    };

    // Attach event listeners to buttons
    let attachedCount = 0;
    for (const [buttonId, handler] of Object.entries(buttonHandlers)) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', handler);
            attachedCount++;
        } else {
            console.log(`❌ Button not found: ${buttonId}`);
        }
    }

    console.log(`🔍 Attached ${attachedCount} button event listeners`);

    // Prevent actual form submission on safe submit button
    const safeSubmitBtn = document.getElementById('btn-form-submit-safe');
    if (safeSubmitBtn) {
        safeSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logToConsole('formHooks-console', 'Form submission prevented (safe mode)', 'info');
        });
    }

    // Setup iframes and message handlers
    try {
        setupIframes();
        setupMessageHandlers();
    } catch (error) {
        console.error("❌ Error setting up iframes:", error);
    }
});