const MODEL_URL = '#APP_FILES#models/';

let currentFacePose = 'UNKNOWN';

let registrationRunning = false;

let capturedFaceSamples = {
    CENTER: null,
    LEFT: null,
    RIGHT: null,
    UP: null,
    DOWN: null
};

const faceRegistrationSteps = [
    'CENTER',
    'LEFT',
    'RIGHT',
    'UP',
    'DOWN'
];

let currentRegistrationStep = 0;

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
])
.then(function () {

    console.log('✅ Tiny Face Detector loaded');
    console.log('✅ Tiny Face Landmark 68 loaded');
    console.log('✅ Face Recognition loaded');

    document.getElementById(
        'faceEnrollmentStatus'
    ).textContent =
        'Face recognition models loaded successfully.';

    document.getElementById(
        'registerFaceBtn'
    ).disabled = false;

})
.catch(function (error) {

    console.error(
        '❌ Model loading failed:',
        error
    );

    document.getElementById(
        'faceEnrollmentStatus'
    ).textContent =
        'Failed to load face recognition models.';

});

let faceEnrollmentStream = null;

async function startFaceEnrollmentCamera() {

    const video =
        document.getElementById(
            'faceEnrollmentVideo'
        );

    const status =
        document.getElementById(
            'faceEnrollmentStatus'
        );

    try {

        status.textContent =
            'Requesting camera access...';

        faceEnrollmentStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user'
                },
                audio: false
            });

        video.srcObject =
            faceEnrollmentStream;

        await video.play();
        startFaceLandmarkTracking();

        status.textContent =
            'Camera started. Position your face in front of the camera.';

        console.log(
            '✅ Camera started successfully'
        );

    }
    catch (error) {

        console.error(
            '❌ Camera error:',
            error
        );

        status.textContent =
            'Unable to access the camera.';

        apex.message.alert(
            'Camera access was denied or is unavailable.'
        );

    }

}

document
    .getElementById(
        'startCameraBtn'
    )
    .addEventListener(
        'click',
        function () {

            startFaceEnrollmentCamera();

        }
    );

    async function detectEnrollmentFace() {

    const video =
        document.getElementById(
            'faceEnrollmentVideo'
        );

    const status =
        document.getElementById(
            'faceEnrollmentStatus'
        );

    try {

        const detection =
            await faceapi
                .detectSingleFace(
                    video,
                    new faceapi.TinyFaceDetectorOptions({
                        inputSize: 320,
                        scoreThreshold: 0.5
                    })
                )
                .withFaceLandmarks(true)
                
                .withFaceDescriptor();

        if (!detection) {

            status.textContent =
                'No face detected. Please look directly at the camera.';

            return null;
        }

        console.log('✅ Face detected');
        console.log(
            'Detection score:',
            detection.detection.score
        );

        console.log(
            'Face descriptor:',
            detection.descriptor
        );

        console.log(
            'Descriptor length:',
            detection.descriptor.length
        );

        status.textContent =
            'Face detected successfully. You can register your face.';

        return detection;

    }
    catch (error) {

        console.error(
            '❌ Face detection error:',
            error
        );

        status.textContent =
            'Face detection failed.';

        return null;
    }

}

let landmarkAnimationFrame = null;

function drawFaceLandmarks(detection) {

    const video = document.getElementById(
        'faceEnrollmentVideo'
    );

    const canvas = document.getElementById(
        'faceLandmarksCanvas'
    );

    if (!video || !canvas) {
        return;
    }

    const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight
    };

    faceapi.matchDimensions(
        canvas,
        displaySize
    );

    const resizedDetection =
        faceapi.resizeResults(
            detection,
            displaySize
        );

    const ctx = canvas.getContext('2d');

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    faceapi.draw.drawFaceLandmarks(
        canvas,
        resizedDetection
    );

    faceapi.draw.drawDetections(
        canvas,
        resizedDetection
    );
}

async function startFaceLandmarkTracking() {

    const video = document.getElementById(
        'faceEnrollmentVideo'
    );

    if (!video) {
        return;
    }

    async function detectFrame() {

        if (
            !video.videoWidth ||
            !video.videoHeight
        ) {
            landmarkAnimationFrame =
                requestAnimationFrame(
                    detectFrame
                );

            return;
        }

        try {

            const detection =
                await faceapi
                    .detectSingleFace(
                        video,
                        new faceapi.TinyFaceDetectorOptions({
                            inputSize: 320,
                            scoreThreshold: 0.5
                        })
                    )
                    .withFaceLandmarks(true);


            if (detection) {

                // Draw landmarks
                drawFaceLandmarks(
                    detection
                );


                // Detect head position
                const pose =
                    estimateFacePose(
                        detection.landmarks
                    );
                    currentFacePose = pose;


                console.log(
                    'Current Pose:',
                    pose
                );


                // Update UI
                updatePoseUI(
                    pose
                );

            }
            else {

                const canvas =
                    document.getElementById(
                        'faceLandmarksCanvas'
                    );

                const ctx =
                    canvas.getContext(
                        '2d'
                    );

                ctx.clearRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );


                updatePoseUI(
                    'UNKNOWN'
                );

            }

        }
        catch (error) {

            console.error(
                'Landmark tracking error:',
                error
            );

        }

        landmarkAnimationFrame =
            requestAnimationFrame(
                detectFrame
            );
    }

    detectFrame();
}
function getPointCenter(points) {
    const x =
        points.reduce((sum, p) => sum + p.x, 0)
        / points.length;

    const y =
        points.reduce((sum, p) => sum + p.y, 0)
        / points.length;

    return { x, y };
}


function estimateFacePose(landmarks) {

    const positions =
        landmarks.positions;

    // Eyes
    const leftEye =
        getPointCenter(
            positions.slice(36, 42)
        );

    const rightEye =
        getPointCenter(
            positions.slice(42, 48)
        );

    // Nose
    const nose =
        positions[30];

    // Mouth
    const mouth =
        getPointCenter(
            positions.slice(48, 68)
        );

    // Jaw
    const jaw =
        positions.slice(0, 17);

    const jawTop =
        Math.min(
            ...jaw.map(p => p.y)
        );

    const jawBottom =
        Math.max(
            ...jaw.map(p => p.y)
        );

    const faceHeight =
        jawBottom - jawTop;

    const eyeDistance =
        Math.abs(
            rightEye.x -
            leftEye.x
        );

    if (
        eyeDistance <= 0 ||
        faceHeight <= 0
    ) {
        return 'UNKNOWN';
    }


    /*
     * Horizontal head rotation
     */

    const eyeCenterX =
        (
            leftEye.x +
            rightEye.x
        ) / 2;

    const horizontalOffset =
        (
            nose.x -
            eyeCenterX
        ) / eyeDistance;


    /*
     * Vertical head movement
     */

    const eyeCenterY =
        (
            leftEye.y +
            rightEye.y
        ) / 2;

    const noseRelativeY =
        (
            nose.y -
            eyeCenterY
        ) / faceHeight;


    /*
     * Determine pose
     */

    // LEFT / RIGHT
    if (horizontalOffset < -0.18) {
        return 'LEFT';
    }

    if (horizontalOffset > 0.18) {
        return 'RIGHT';
    }


    // UP / DOWN
    if (noseRelativeY < 0.20) {
        return 'UP';
    }

    if (noseRelativeY > 0.30) {
        return 'DOWN';
    }


    // CENTER
    return 'CENTER';
}
function updatePoseUI(pose) {

    const title =
        document.getElementById(
            'faceDirectionTitle'
        );

    const description =
        document.getElementById(
            'faceDirectionDescription'
        );

    const holdText =
        document.getElementById(
            'faceHoldText'
        );

    const holdDot =
        document.getElementById(
            'faceHoldDot'
        );


    holdDot.classList.add('ready');


    switch (pose) {

        case 'CENTER':

            title.textContent =
                'Look Straight';

            description.textContent =
                'Look directly at the camera.';

            holdText.textContent =
                'Face centered';

            break;


        case 'LEFT':

            title.textContent =
                'Turn Left';

            description.textContent =
                'Slowly turn your head to the left.';

            holdText.textContent =
                'Left pose detected';

            break;


        case 'RIGHT':

            title.textContent =
                'Turn Right';

            description.textContent =
                'Slowly turn your head to the right.';

            holdText.textContent =
                'Right pose detected';

            break;


        case 'UP':

            title.textContent =
                'Look Up';

            description.textContent =
                'Raise your head slightly.';

            holdText.textContent =
                'Up pose detected';

            break;


        case 'DOWN':

            title.textContent =
                'Look Down';

            description.textContent =
                'Lower your head slightly.';

            holdText.textContent =
                'Down pose detected';

            break;


        default:

            title.textContent =
                'Face Detected';

            description.textContent =
                'Adjust your position.';

            holdText.textContent =
                'Adjusting...';

            holdDot.classList.remove(
                'ready'
            );
    }

}
function delay(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}
async function runFaceCountdown(expectedPose) {

    const countdown =
        document.getElementById(
            'faceCountdown'
        );

    const number =
        document.getElementById(
            'faceCountdownNumber'
        );

    for (let i = 3; i >= 1; i--) {

        // Make sure the face is still in the required pose
        if (
            currentFacePose !== expectedPose
        ) {

            countdown.classList.add(
                'hidden'
            );

            return false;
        }

        number.textContent = i;

        countdown.classList.remove(
            'hidden'
        );

        // Restart animation
        number.style.animation = 'none';

        void number.offsetWidth;

        number.style.animation =
            'countdownPulse 1s ease';

        await delay(1000);
    }

    countdown.classList.add(
        'hidden'
    );

    return true;
}
async function captureFaceDescriptor() {

    const video =
        document.getElementById(
            'faceEnrollmentVideo'
        );

    const detection =
        await faceapi
            .detectSingleFace(
                video,
                new faceapi.TinyFaceDetectorOptions({
                    inputSize: 320,
                    scoreThreshold: 0.5
                })
            )
            .withFaceLandmarks(true)
            .withFaceDescriptor();

    if (!detection) {
        return null;
    }

    return Array.from(
        detection.descriptor
    );
}

function showCaptureFlash() {

    const flash =
        document.getElementById(
            'faceCaptureFlash'
        );

    flash.classList.remove(
        'active'
    );

    void flash.offsetWidth;

    flash.classList.add(
        'active'
    );
}

function updateRegistrationStep(stepIndex) {
    if (stepIndex >= 5) {
    document.querySelectorAll('.face-step')
        .forEach(function(step) {
            step.classList.remove('active');
            step.classList.add('completed');
        });

    document.getElementById(
        'faceStepText'
    ).textContent = 'Registration Complete';

    document.getElementById(
        'faceProgressPercent'
    ).textContent = '100%';

    document.getElementById(
        'faceProgressFill'
    ).style.width = '100%';

    return;
}

    const stepName =
        faceRegistrationSteps[
            stepIndex
        ];

    const progress =
        Math.round(
            (
                stepIndex /
                faceRegistrationSteps.length
            ) * 100
        );

    document.getElementById(
        'faceStepText'
    ).textContent =
        `Step ${stepIndex + 1} of 5`;

    document.getElementById(
        'faceProgressPercent'
    ).textContent =
        `${progress}%`;

    document.getElementById(
        'faceProgressFill'
    ).style.width =
        `${progress}%`;


    document
        .querySelectorAll(
            '.face-step'
        )
        .forEach(
            function (step) {

                step.classList.remove(
                    'active'
                );

                step.classList.remove(
                    'completed'
                );

            }
        );


    faceRegistrationSteps.forEach(
        function (step, index) {

            const element =
                document.querySelector(
                    `.face-step[data-step="${step}"]`
                );

            if (!element) {
                return;
            }

            if (index < stepIndex) {

                element.classList.add(
                    'completed'
                );

            }
            else if (
                index === stepIndex
            ) {

                element.classList.add(
                    'active'
                );

            }

        }
    );
}

function updateExpectedPoseUI(pose) {

    const title =
        document.getElementById(
            'faceDirectionTitle'
        );

    const description =
        document.getElementById(
            'faceDirectionDescription'
        );

    const icon =
        document.getElementById(
            'faceDirectionIcon'
        );

    switch (pose) {

        case 'CENTER':

            title.textContent =
                'Look Straight';

            description.textContent =
                'Look directly at the camera and keep your face inside the guide.';

            icon.className =
                'fa fa-user';

            break;


        case 'LEFT':

            title.textContent =
                'Turn Left';

            description.textContent =
                'Slowly turn your head to the left and hold the position.';

            icon.className =
                'fa fa-arrow-left';

            break;


        case 'RIGHT':

            title.textContent =
                'Turn Right';

            description.textContent =
                'Slowly turn your head to the right and hold the position.';

            icon.className =
                'fa fa-arrow-right';

            break;


        case 'UP':

            title.textContent =
                'Look Up';

            description.textContent =
                'Raise your head slightly and hold the position.';

            icon.className =
                'fa fa-arrow-up';

            break;


        case 'DOWN':

            title.textContent =
                'Look Down';

            description.textContent =
                'Lower your head slightly and hold the position.';

            icon.className =
                'fa fa-arrow-down';

            break;

    }
}

async function waitForCorrectPose(expectedPose) {

    const status =
        document.getElementById(
            'faceEnrollmentStatus'
        );

    const holdText =
        document.getElementById(
            'faceHoldText'
        );

    const holdDot =
        document.getElementById(
            'faceHoldDot'
        );

    updateExpectedPoseUI(
        expectedPose
    );


    while (registrationRunning) {

        if (
            currentFacePose === expectedPose
        ) {

            holdDot.classList.add(
                'ready'
            );

            holdText.textContent =
                'Position correct. Hold still...';

            status.textContent =
                'Perfect. Hold your position.';

            return true;
        }


        holdDot.classList.remove(
            'ready'
        );

        holdText.textContent =
            'Adjust your position...';

        status.textContent =
            `Please ${getPoseInstruction(expectedPose)}.`;

        await delay(150);

    }

    return false;
}

function getPoseInstruction(pose) {

    switch (pose) {

        case 'CENTER':
            return 'look straight';

        case 'LEFT':
            return 'turn your head left';

        case 'RIGHT':
            return 'turn your head right';

        case 'UP':
            return 'look up slightly';

        case 'DOWN':
            return 'look down slightly';

        default:
            return 'position your face correctly';
    }
}

async function captureRegistrationStep(
    expectedPose,
    stepIndex
) {

    const status =
        document.getElementById(
            'faceEnrollmentStatus'
        );

    updateRegistrationStep(
        stepIndex
    );


    const poseReady =
        await waitForCorrectPose(
            expectedPose
        );

    if (!poseReady) {
        return false;
    }


    // Countdown
    const countdownSuccess =
        await runFaceCountdown(
            expectedPose
        );

    if (!countdownSuccess) {

        status.textContent =
            'Position changed. Please try again.';

        return false;
    }


    // Capture
    const descriptor =
        await captureFaceDescriptor();


    if (!descriptor) {

        status.textContent =
            'Face was lost. Please try again.';

        return false;
    }


    // Make sure pose did not change during capture
    if (
        currentFacePose !== expectedPose
    ) {

        status.textContent =
            'Pose changed during capture. Trying again...';

        return false;
    }


    capturedFaceSamples[
        expectedPose
    ] = descriptor;


    showCaptureFlash();


    console.log(
        `✅ ${expectedPose} captured`
    );

    console.log(
        'Descriptor length:',
        descriptor.length
    );


    status.textContent =
        `✓ ${expectedPose} captured successfully.`;

    await delay(700);

    return true;
}

async function startFaceRegistration() {

    if (registrationRunning) {
        return;
    }

    registrationRunning = true;

    currentRegistrationStep = 0;

    capturedFaceSamples = {
        CENTER: null,
        LEFT: null,
        RIGHT: null,
        UP: null,
        DOWN: null
    };


    const status =
        document.getElementById(
            'faceEnrollmentStatus'
        );

    const button =
        document.getElementById(
            'registerFaceBtn'
        );


    button.disabled = true;

    status.textContent =
        'Starting face registration...';


    for (
        let i = 0;
        i < faceRegistrationSteps.length;
        i++
    ) {

        currentRegistrationStep = i;

        const pose =
            faceRegistrationSteps[i];

        let captured = false;


        while (
            !captured &&
            registrationRunning
        ) {

            captured =
                await captureRegistrationStep(
                    pose,
                    i
                );

        }

    }


    if (!registrationRunning) {
        return;
    }


    // Complete
    updateRegistrationStep(5);

    document.getElementById(
        'faceProgressPercent'
    ).textContent = '100%';

    document.getElementById(
        'faceProgressFill'
    ).style.width = '100%';


    status.textContent =
        '🎉 All five face samples captured successfully.';


    console.log(
        '✅ ALL FACE SAMPLES CAPTURED'
    );

    console.log(
        capturedFaceSamples
    );

    await saveFaceSamples();


    registrationRunning = false;

    button.disabled = false;
}

async function saveFaceSamples() {

    const status =
        document.getElementById(
            'faceEnrollmentStatus'
        );

    status.textContent =
        'Saving your five face samples...';


    try {

        const response =
            await new Promise(
                function (resolve, reject) {

                    apex.server.process(
                        'SAVE_FACE_SAMPLES',
                        {
                            x01:
                                JSON.stringify(
                                    capturedFaceSamples.CENTER
                                ),

                            x02:
                                JSON.stringify(
                                    capturedFaceSamples.LEFT
                                ),

                            x03:
                                JSON.stringify(
                                    capturedFaceSamples.RIGHT
                                ),

                            x04:
                                JSON.stringify(
                                    capturedFaceSamples.UP
                                ),

                            x05:
                                JSON.stringify(
                                    capturedFaceSamples.DOWN
                                )
                        },
                        {
                            dataType: 'json',

                            success:
                                function (data) {

                                    resolve(data);

                                },

                            error:
                                function (
                                    jqXHR,
                                    textStatus,
                                    errorThrown
                                ) {

                                    reject(
                                        new Error(
                                            errorThrown ||
                                            textStatus
                                        )
                                    );

                                }
                        }
                    );

                }
            );


        console.log(
            'SAVE_FACE_SAMPLES response:',
            response
        );


        if (!response.success) {

            throw new Error(
                response.message ||
                'Failed to save face samples.'
            );

        }


        status.textContent =
            '✅ Your face profile has been registered successfully.';


        apex.message.showPageSuccess(
            'All 5 face samples were registered successfully.'
        );


        /*
           Mark registration as complete
        */

        updateRegistrationStep(5);

        document.getElementById(
            'faceProgressFill'
        ).style.width = '100%';

        document.getElementById(
            'faceProgressPercent'
        ).textContent = '100%';


    }
    catch (error) {

        console.error(
            '❌ Save face samples error:',
            error
        );

        status.textContent =
            'Failed to save face samples.';

        apex.message.alert(
            error.message
        );

    }

}

document
    .getElementById(
        'registerFaceBtn'
    )
    .addEventListener(
        'click',
        function () {

            startFaceRegistration();

        }
    );