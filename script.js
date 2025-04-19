document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('grass-canvas');
    const ctx = canvas.getContext('2d');

    if (!canvas || !ctx) {
        console.error("Error: Canvas element or context not found!");
        return;
    }

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let blades = [];

    let currentZoomLevel = 2.5;
    let currentDensity = 0.25;
    let currentInteractionRadiusBase = 150;
    let currentVolume = 0.33;

    let interactionRadius = currentInteractionRadiusBase / currentZoomLevel;

    let viewX = 0;
    let viewY = 0;

    const MAX_ROTATION = 70;
    const SCALE_FACTOR = 0.9;
    const OUTER_CULLING_BUFFER = 100;
    let worldMouseX = -interactionRadius * 2;
    let worldMouseY = -interactionRadius * 2;
    let mouseX = width / 2;
    let mouseY = height / 2;

    let grabbedBlade = null;
    let grabOffsetX = 0;
    let grabOffsetY = 0;

    let lastTimestamp = 0;

    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValueSpan = document.getElementById('zoom-value');
    const densitySlider = document.getElementById('density-slider');
    const densityValueSpan = document.getElementById('density-value');
    const radiusSlider = document.getElementById('radius-slider');
    const radiusValueSpan = document.getElementById('radius-value');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValueSpan = document.getElementById('volume-value');
    const backgroundAudio = document.getElementById('background-audio');
    const unmutePrompt = document.getElementById('unmute-prompt');
    const regenerateButton = document.getElementById('regenerate-button');

    function createBlade(xPos, yPos) {
        const bladeHeight = 35 + Math.random() * 25;
        const bladeWidth = 5 + Math.random() * 5;
        const hueVariation = (Math.random() - 0.5) * 25;
        const lightnessVariation = Math.random() * 10;
        const color1 = `hsl(${115 + hueVariation}, 65%, ${12 + lightnessVariation}%)`;
        const color2 = `hsl(${120 + hueVariation}, 55%, ${25 + lightnessVariation}%)`;
        const initialRotation = (Math.random() - 0.5) * 20;
        const age = Math.random() * 150000;
        const maxAge = 300000 + Math.random() * 300000;

        return {
            x: xPos, y: yPos, w: bladeWidth, h: bladeHeight,
            color1: color1, color2: color2,
            initialRotation: initialRotation,
            currentRotation: initialRotation,
            scale: 0,
            state: 'growing',
            age: age,
            maxAge: maxAge
        };
    }

    function generateBlades() {
        blades = [];
        const bladeCount = calculateBladeCount();

        for (let i = 0; i < bladeCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            blades.push(createBlade(x, y));
        }
        blades.sort((a, b) => a.y - b.y);

        if (backgroundAudio) {
            backgroundAudio.volume = Math.pow(currentVolume, 3);
            backgroundAudio.play().catch(e => console.log("Initial muted play failed (can be expected):", e));
        }
    }

    function updateAndDraw(timestamp) {
        const deltaTime = timestamp - lastTimestamp || (1000 / 60);
        lastTimestamp = timestamp;

        const offsetX = (width / 2) * (1 - currentZoomLevel);
        const offsetY = (height / 2) * (1 - currentZoomLevel);

        const visibleWorldWidth = width / currentZoomLevel;
        const visibleWorldHeight = height / currentZoomLevel;
        viewX = (width - visibleWorldWidth) / 2;
        viewY = (height - visibleWorldHeight) / 2;

        worldMouseX = (mouseX - offsetX) / currentZoomLevel;
        worldMouseY = (mouseY - offsetY) / currentZoomLevel;

        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(currentZoomLevel, currentZoomLevel);

        let visibleCount = 0;
        for (let i = 0; i < blades.length; i++) {
            const blade = blades[i];

            if (blade.x > viewX - OUTER_CULLING_BUFFER && blade.x < viewX + visibleWorldWidth + OUTER_CULLING_BUFFER &&
                blade.y > viewY - OUTER_CULLING_BUFFER && blade.y < viewY + visibleWorldHeight + OUTER_CULLING_BUFFER)
            {
                if (blade.state === 'plucked') {
                    continue;
                }

                blade.age += deltaTime;

                let targetRotation = blade.initialRotation;
                let targetScale = 1;
                const lerpFactor = 0.05;

                if (blade.state === 'grabbed') {
                    blade.x = worldMouseX + grabOffsetX;
                    blade.y = worldMouseY + grabOffsetY;
                    targetRotation = 0;
                    targetScale = 1.1;
                } else if (blade.state === 'falling') {
                    targetScale = 0;
                    targetRotation = blade.currentRotation + 15;
                    if (blade.scale < 0.05) {
                        blade.state = 'plucked';
                        continue;
                    }
                } else if (blade.state === 'wilting') {
                    targetScale = 0;
                    targetRotation = blade.currentRotation + 2;
                    if (blade.scale < 0.05) {
                        handleWiltedBlade(i);
                        continue;
                    }
                } else if (blade.state === 'growing') {
                    if (blade.age >= blade.maxAge) {
                        blade.state = 'wilting';
                        targetScale = 0;
                    } else {
                        const dxMouse = blade.x - worldMouseX;
                        const interactionCenterY = worldMouseY + 15;
                        const dyMouse = blade.y - interactionCenterY;
                        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

                        if (distMouse < interactionRadius) {
                            const mouseInfluence = Math.pow(1 - (distMouse / interactionRadius), 1.5);
                            const rotationInfluence = (dxMouse / interactionRadius) * MAX_ROTATION * mouseInfluence;
                            targetRotation = blade.initialRotation + rotationInfluence;
                        
                            if (distMouse < interactionRadius * 0.4) {
                                targetScale = 1 - (1 - SCALE_FACTOR) * (1 - distMouse / (interactionRadius * 0.4));
                            }
                        }
                    }
                }

                blade.currentRotation += (targetRotation - blade.currentRotation) * lerpFactor;
                blade.scale += (targetScale - blade.scale) * lerpFactor;

                const bladeLeft = blade.x - blade.w * 0.5 * blade.scale;
                const bladeRight = blade.x + blade.w * 0.5 * blade.scale;
                const bladeTop = blade.y - blade.h * blade.scale;
                const bladeBottom = blade.y;

                const viewLeft = viewX;
                const viewRight = viewX + visibleWorldWidth;
                const viewTop = viewY;
                const viewBottom = viewY + visibleWorldHeight;

                if (bladeRight > viewLeft &&
                    bladeLeft < viewRight &&
                    bladeBottom > viewTop &&
                    bladeTop < viewBottom)
                {
                    visibleCount++;
                    drawBlade(blade);
                }
            }
        }

        ctx.restore();

        requestAnimationFrame(updateAndDraw);
    }

    function drawBlade(blade) {
        ctx.save();
        ctx.translate(blade.x, blade.y);
        ctx.rotate(blade.currentRotation * Math.PI / 180);
        ctx.scale(blade.scale, blade.scale);

        const gradient = ctx.createLinearGradient(0, 0, 0, -blade.h);
        gradient.addColorStop(0, blade.color1);
        gradient.addColorStop(1, blade.color2);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(-blade.w * 0.4, 0);
        ctx.lineTo(blade.w * 0.4, 0);
        ctx.quadraticCurveTo(blade.w * 0.3, -blade.h * 0.8, 0, -blade.h);
        ctx.quadraticCurveTo(-blade.w * 0.3, -blade.h * 0.8, -blade.w * 0.4, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function calculateBladeCount() {
        const screenArea = width * height;
        const maxBlades = Math.min(15000, Math.max(1000, Math.floor(screenArea * currentDensity / 100)));
        return maxBlades;
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        generateBlades();
        mouseX = width / 2;
        mouseY = height / 2;
    });

    function initializeControls() {
        zoomSlider.value = currentZoomLevel;
        zoomValueSpan.textContent = currentZoomLevel.toFixed(1);
        densitySlider.value = currentDensity;
        densityValueSpan.textContent = currentDensity.toFixed(2);
        radiusSlider.value = currentInteractionRadiusBase;
        radiusValueSpan.textContent = currentInteractionRadiusBase.toFixed(0);
        volumeSlider.value = currentVolume;
        volumeValueSpan.textContent = currentVolume.toFixed(2);

        if (backgroundAudio) {
            backgroundAudio.volume = Math.pow(currentVolume, 3);
        }

        zoomSlider.addEventListener('input', (e) => {
            currentZoomLevel = parseFloat(e.target.value);
            zoomValueSpan.textContent = currentZoomLevel.toFixed(1);
            interactionRadius = currentInteractionRadiusBase / currentZoomLevel;
        });

        densitySlider.addEventListener('input', (e) => {
            currentDensity = parseFloat(e.target.value);
            densityValueSpan.textContent = currentDensity.toFixed(2);
            generateBlades();
        });

        radiusSlider.addEventListener('input', (e) => {
            currentInteractionRadiusBase = parseFloat(e.target.value);
            radiusValueSpan.textContent = currentInteractionRadiusBase.toFixed(0);
            interactionRadius = currentInteractionRadiusBase / currentZoomLevel;
        });

        volumeSlider.addEventListener('input', (e) => {
            currentVolume = parseFloat(e.target.value);
            volumeValueSpan.textContent = currentVolume.toFixed(2);
            if (backgroundAudio) {
                backgroundAudio.volume = Math.pow(currentVolume, 3);
            }
        });

        if (unmutePrompt && backgroundAudio) {
            unmutePrompt.addEventListener('click', () => {
                backgroundAudio.muted = false;
                backgroundAudio.volume = Math.pow(currentVolume, 3);
                backgroundAudio.play().then(() => {
                }).catch(error => {
                    console.error("Error playing audio after unmute:", error);
                });
                unmutePrompt.style.display = 'none';
            }, { once: true });
        } else {
             if (!unmutePrompt) console.error("Unmute prompt element not found!");
             if (!backgroundAudio) console.error("Background audio element not found!");
        }
    }

    if (regenerateButton) {
        regenerateButton.addEventListener('click', () => {
            console.log("Regenerating blades...");
            generateBlades();
        });
    } else {
        console.error("Regenerate button not found!");
    }

    canvas.addEventListener('mousedown', (e) => {
        const offsetX = (width / 2) * (1 - currentZoomLevel);
        const offsetY = (height / 2) * (1 - currentZoomLevel);
        const clickWorldX = (e.clientX - offsetX) / currentZoomLevel;
        const clickWorldY = (e.clientY - offsetY) / currentZoomLevel;

        let closestBlade = null;

        for (let i = blades.length - 1; i >= 0; i--) {
            const blade = blades[i];
            if (blade.state !== 'growing') continue;

            const bladeLeft = blade.x - blade.w * 0.5;
            const bladeRight = blade.x + blade.w * 0.5;
            const bladeTop = blade.y - blade.h;
            const bladeBottom = blade.y;

            if (clickWorldX >= bladeLeft && clickWorldX <= bladeRight &&
                clickWorldY >= bladeTop && clickWorldY <= bladeBottom)
            {
                closestBlade = blade;
                break;
            }
        }

        if (closestBlade) {
            grabbedBlade = closestBlade;
            grabbedBlade.state = 'grabbed';
            grabOffsetX = grabbedBlade.x - clickWorldX;
            grabOffsetY = grabbedBlade.y - clickWorldY;
        }
    });

    document.addEventListener('mouseup', () => {
        if (grabbedBlade) {
            const MIN_BLADES_BEFORE_PLUCK = 50;
            let growingBladeCount = 0;
            for (const blade of blades) {
                if (blade.state !== 'plucked') {
                    growingBladeCount++;
                }
            }

            if (growingBladeCount > MIN_BLADES_BEFORE_PLUCK) {
                grabbedBlade.state = 'falling';
            } else {
                grabbedBlade.state = 'growing';
            }
            
            grabbedBlade = null;
        }
    });

    function handleWiltedBlade(index) {
        const targetBladeCount = calculateBladeCount();
        let currentBladeCount = 0;
        for (const blade of blades) {
            if (blade.state !== 'plucked') {
                currentBladeCount++;
            }
        }

        if (currentBladeCount <= targetBladeCount) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            blades[index] = createBlade(x, y);
        } else {
            blades[index].state = 'plucked';
        }
    }

    initializeControls();
    generateBlades();
    requestAnimationFrame(updateAndDraw);
}); 