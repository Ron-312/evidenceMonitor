// Iframe setup and message handlers for surveillance test page
console.log("🔍 DEBUG: iframe-handlers.js loaded");

// Setup iframe content
function setupIframes() {
    console.log("🔍 Setting up iframes...");

    // Setup test iframe
    const testIframe = document.getElementById('test-iframe');
    if (testIframe) {
        testIframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial; padding: 20px; background: #f9f9f9; }
                    input { width: 200px; padding: 8px; margin: 5px 0; display: block; }
                    button { padding: 10px 20px; background: #ff6b35; color: white; border: none; cursor: pointer; margin: 5px 0; }
                </style>
            </head>
            <body>
                <h3>Iframe Form</h3>
                <form id="iframe-form">
                    <input type="text" name="username" placeholder="Username" value="testuser">
                    <input type="password" name="password" placeholder="Password" value="testpass">
                    <input type="email" name="email" placeholder="Email" value="test@example.com">
                    <button type="button" onclick="attackIframe()">🚨 Attack Iframe</button>
                    <button type="submit">Submit</button>
                </form>

                <script>
                    function attackIframe() {
                        const inputs = document.querySelectorAll("input");
                        inputs.forEach(input => {
                            input.addEventListener("input", function() {
                                console.log("IFRAME ATTACK: " + input.name + " = " + input.value);
                                parent.postMessage({type: "iframe-data", field: input.name, value: input.value}, "*");
                            });

                            // Access values immediately
                            const value = input.value;
                            console.log("IFRAME STOLEN: " + input.name + " = " + value);
                            parent.postMessage({type: "iframe-data", field: input.name, value: value}, "*");
                        });
                        parent.postMessage({type: "iframe-data", field: "status", value: "Attack listeners added!"}, "*");
                    }
                </script>
            </body>
            </html>
        `;
    }

    // Setup cross-frame attacker iframe
    const crossFrameIframe = document.getElementById('cross-frame-attacker');
    if (crossFrameIframe) {
        crossFrameIframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial; padding: 20px; background: #ffe6e6; border: 2px solid #ff4444; }
                    .attack-button { padding: 10px 20px; background: #ff4444; color: white; border: none; cursor: pointer; margin: 5px; }
                    .attack-info { background: #fff; padding: 10px; margin: 10px 0; border-left: 4px solid #ff4444; }
                </style>
            </head>
            <body>
                <h3>🚨 Malicious Iframe - Cross-Frame Attack</h3>
                <div class="attack-info">
                    <strong>Attack Scenario:</strong> This iframe will attempt to access form elements in the parent frame.
                    These attempts should be blocked by same-origin policy but our extension should detect the attempts.
                </div>

                <button class="attack-button" onclick="attemptCrossFrameAccess()">
                    🎯 Attack Parent Frame Elements
                </button>

                <button class="attack-button" onclick="attemptMultipleAccess()">
                    🔄 Multiple Access Attempts
                </button>

                <button class="attack-button" onclick="attemptStealthyAccess()">
                    🥷 Stealthy Access Pattern
                </button>

                <script>
                    function attemptCrossFrameAccess() {
                        console.log("🚨 [IFRAME ATTACK] Starting cross-frame access attempts...");

                        try {
                            const password = parent.document.getElementById("mainFramePassword").value;
                            parent.postMessage({type: "stolen-data", field: "password", value: password}, "*");
                        } catch (e) {
                            console.log("❌ [IFRAME ATTACK] Password access blocked:", e.message);
                            parent.postMessage({type: "attack-blocked", target: "mainFramePassword", error: e.message}, "*");
                        }

                        try {
                            const username = parent.document.getElementById("mainFrameUsername").value;
                            parent.postMessage({type: "stolen-data", field: "username", value: username}, "*");
                        } catch (e) {
                            console.log("❌ [IFRAME ATTACK] Username access blocked:", e.message);
                            parent.postMessage({type: "attack-blocked", target: "mainFrameUsername", error: e.message}, "*");
                        }

                        try {
                            const ssn = parent.document.getElementById("mainFrameSSN").value;
                            parent.postMessage({type: "stolen-data", field: "ssn", value: ssn}, "*");
                        } catch (e) {
                            console.log("❌ [IFRAME ATTACK] SSN access blocked:", e.message);
                            parent.postMessage({type: "attack-blocked", target: "mainFrameSSN", error: e.message}, "*");
                        }
                    }

                    function attemptMultipleAccess() {
                        console.log("🔄 [IFRAME ATTACK] Multiple rapid access attempts...");
                        const targets = ["mainFramePassword", "mainFrameUsername", "mainFrameSSN"];

                        targets.forEach((targetId, index) => {
                            setTimeout(() => {
                                try {
                                    const element = parent.document.getElementById(targetId);
                                    const value = element.value;
                                    console.log(\`✅ [IFRAME ATTACK] Rapid steal \${index + 1}:\`, value);
                                    parent.postMessage({type: "rapid-attack", attempt: index + 1, target: targetId, value: value}, "*");
                                } catch (e) {
                                    console.log(\`❌ [IFRAME ATTACK] Rapid attempt \${index + 1} blocked:\`, e.message);
                                    parent.postMessage({type: "rapid-attack-blocked", attempt: index + 1, target: targetId, error: e.message}, "*");
                                }
                            }, index * 100);
                        });
                    }

                    function attemptStealthyAccess() {
                        console.log("🥷 [IFRAME ATTACK] Stealthy access pattern...");

                        setTimeout(() => {
                            try {
                                const pwd1 = parent.document.querySelector("#mainFramePassword").value;
                                parent.postMessage({type: "stealthy-attack", method: "querySelector", value: pwd1}, "*");
                            } catch (e) {
                                parent.postMessage({type: "stealthy-blocked", method: "querySelector", error: e.message}, "*");
                            }
                        }, 500);

                        setTimeout(() => {
                            try {
                                const pwd2 = parent.document.getElementsByName("mainPassword")[0].value;
                                parent.postMessage({type: "stealthy-attack", method: "getElementsByName", value: pwd2}, "*");
                            } catch (e) {
                                parent.postMessage({type: "stealthy-blocked", method: "getElementsByName", error: e.message}, "*");
                            }
                        }, 1000);
                    }

                    window.addEventListener("load", () => {
                        console.log("🚨 [IFRAME ATTACK] Cross-frame attacker iframe loaded");
                        parent.postMessage({type: "attacker-ready"}, "*");
                    });
                </script>
            </body>
            </html>
        `;
    }
}

// Message handlers for iframe communication
function setupMessageHandlers() {
    console.log("🔍 Setting up message handlers...");

    window.addEventListener('message', function(event) {
        if (!event.data) return;

        // Handle iframe surveillance messages
        if (event.data.type === 'iframe-data') {
            logToConsole('iframe-console',
                `IFRAME SURVEILLANCE: ${event.data.field} = "${event.data.value}"`,
                'attack'
            );
        }

        // Handle cross-frame attack messages
        switch (event.data.type) {
            case 'attacker-ready':
                logToConsole('cross-frame-console',
                    '🚨 Cross-frame attacker iframe loaded and ready for attacks',
                    'warn'
                );
                break;

            case 'stolen-data':
                logToConsole('cross-frame-console',
                    `🚨 CRITICAL: Cross-frame data theft! Field: ${event.data.field}, Stolen: "${event.data.value}"`,
                    'attack'
                );
                break;

            case 'attack-blocked':
                logToConsole('cross-frame-console',
                    `✅ Cross-frame attack blocked! Target: ${event.data.target}, Error: ${event.data.error}`,
                    'info'
                );
                break;

            case 'rapid-attack':
                logToConsole('cross-frame-console',
                    `🔄 RAPID ATTACK ${event.data.attempt}: Target: ${event.data.target}, Stolen: "${event.data.value}"`,
                    'attack'
                );
                break;

            case 'rapid-attack-blocked':
                logToConsole('cross-frame-console',
                    `✅ Rapid attack ${event.data.attempt} blocked! Target: ${event.data.target}`,
                    'info'
                );
                break;

            case 'stealthy-attack':
                logToConsole('cross-frame-console',
                    `🥷 STEALTHY ATTACK via ${event.data.method}: Stolen: "${event.data.value}"`,
                    'attack'
                );
                break;

            case 'stealthy-blocked':
                logToConsole('cross-frame-console',
                    `✅ Stealthy attack via ${event.data.method} blocked!`,
                    'info'
                );
                break;
        }
    });

}

// Make functions globally available
window.setupIframes = setupIframes;
window.setupMessageHandlers = setupMessageHandlers;