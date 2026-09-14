DECLARE
    l_identifier        VARCHAR2(255);
    l_client_descriptor CLOB;

    l_user_id           FA_USERS.ID%TYPE;
    l_username          FA_USERS.USERNAME%TYPE;
    l_profile_id        FA_FACE_PROFILES.FACE_PROFILE_ID%TYPE;

    l_descriptor_count  NUMBER := 0;
    l_sample_count      NUMBER := 0;

    l_distance          NUMBER;
    l_best_distance     NUMBER := 999;
    l_best_angle        VARCHAR2(20);

    l_threshold         CONSTANT NUMBER := 0.60;
    l_status            VARCHAR2(20);
BEGIN

    /* Get values sent from JavaScript */
    l_identifier := TRIM(apex_application.g_x01);
    l_client_descriptor := apex_application.g_x02;


    /* Username / Email validation */
    IF l_identifier IS NULL THEN

        apex_json.open_object;
        apex_json.write('success', false);
        apex_json.write('status', 'USERNAME_REQUIRED');
        apex_json.write(
            'message',
            'Username or Email is required.'
        );
        apex_json.close_object;

        RETURN;

    END IF;


    /* Descriptor validation */
    IF l_client_descriptor IS NULL THEN

        apex_json.open_object;
        apex_json.write('success', false);
        apex_json.write(
            'status',
            'DESCRIPTOR_REQUIRED'
        );
        apex_json.write(
            'message',
            'Face descriptor is required.'
        );
        apex_json.close_object;

        RETURN;

    END IF;


    /* Validate descriptor length = 128 */
    SELECT COUNT(*)
    INTO l_descriptor_count
    FROM JSON_TABLE(
        l_client_descriptor,
        '$[*]'
        COLUMNS (
            idx FOR ORDINALITY,
            val NUMBER PATH '$'
        )
    );


    IF l_descriptor_count <> 128 THEN

        apex_json.open_object;
        apex_json.write(
            'success',
            false
        );
        apex_json.write(
            'status',
            'INVALID_DESCRIPTOR'
        );
        apex_json.write(
            'message',
            'Invalid face descriptor.'
        );
        apex_json.close_object;

        RETURN;

    END IF;


    /* Find active user by Username OR Email */
    BEGIN

        SELECT
            id,
            username
        INTO
            l_user_id,
            l_username
        FROM FA_USERS
        WHERE account_status = 1
          AND (
                UPPER(username) = UPPER(l_identifier)
                OR
                LOWER(email) = LOWER(l_identifier)
              )
        FETCH FIRST 1 ROW ONLY;

    EXCEPTION

        WHEN NO_DATA_FOUND THEN

            apex_json.open_object;
            apex_json.write(
                'success',
                false
            );
            apex_json.write(
                'status',
                'USER_NOT_FOUND'
            );
            apex_json.write(
                'message',
                'User does not exist or is inactive.'
            );
            apex_json.close_object;

            RETURN;

    END;


    /* Get face profile */
    BEGIN

        SELECT
            face_profile_id
        INTO
            l_profile_id
        FROM FA_FACE_PROFILES
        WHERE user_id = l_user_id;

    EXCEPTION

        WHEN NO_DATA_FOUND THEN

            apex_json.open_object;
            apex_json.write(
                'success',
                false
            );
            apex_json.write(
                'status',
                'NO_FACE_PROFILE'
            );
            apex_json.write(
                'message',
                'No face profile is registered for this user.'
            );
            apex_json.close_object;

            RETURN;

    END;


    /* Make sure face samples exist */
    SELECT COUNT(*)
    INTO l_sample_count
    FROM FA_FACE_SAMPLES
    WHERE face_profile_id = l_profile_id;


    IF l_sample_count = 0 THEN

        apex_json.open_object;
        apex_json.write(
            'success',
            false
        );
        apex_json.write(
            'status',
            'NO_FACE_SAMPLES'
        );
        apex_json.write(
            'message',
            'No face samples are registered for this user.'
        );
        apex_json.close_object;

        RETURN;

    END IF;


    /* Compare current descriptor with stored samples */
    FOR r IN (
        SELECT
            angle_code,
            face_descriptor
        FROM FA_FACE_SAMPLES
        WHERE face_profile_id = l_profile_id
    )
    LOOP

        SELECT SQRT(
                   SUM(
                       POWER(
                           c.val - s.val,
                           2
                       )
                   )
               )
        INTO l_distance
        FROM JSON_TABLE(
                 l_client_descriptor,
                 '$[*]'
                 COLUMNS (
                     idx FOR ORDINALITY,
                     val NUMBER PATH '$'
                 )
             ) c
        JOIN JSON_TABLE(
                 r.face_descriptor,
                 '$[*]'
                 COLUMNS (
                     idx FOR ORDINALITY,
                     val NUMBER PATH '$'
                 )
             ) s
        ON c.idx = s.idx;


        /* Keep the closest sample */
        IF l_distance < l_best_distance THEN

            l_best_distance := l_distance;
            l_best_angle := r.angle_code;

        END IF;

    END LOOP;


    /* Determine match result */
    IF l_best_distance <= l_threshold THEN

        l_status := 'MATCH';

        /*
         * Face verified successfully.
         * Authenticate current APEX session.
         */
        APEX_AUTHENTICATION.POST_LOGIN(
            p_username           => l_username,
            p_password           => NULL,
            p_uppercase_username => TRUE
        );


        apex_json.open_object;

        apex_json.write(
            'success',
            true
        );

        apex_json.write(
            'status',
            'MATCH'
        );

        apex_json.write(
            'authenticated',
            true
        );

        apex_json.write(
            'distance',
            ROUND(l_best_distance, 6)
        );

        apex_json.write(
            'threshold',
            l_threshold
        );

        apex_json.write(
            'matched_angle',
            l_best_angle
        );

        apex_json.write(
            'username',
            l_username
        );

        apex_json.close_object;


    ELSE

        l_status := 'NO_MATCH';


        apex_json.open_object;

        apex_json.write(
            'success',
            true
        );

        apex_json.write(
            'status',
            'NO_MATCH'
        );

        apex_json.write(
            'authenticated',
            false
        );

        apex_json.write(
            'distance',
            ROUND(l_best_distance, 6)
        );

        apex_json.write(
            'threshold',
            l_threshold
        );

        apex_json.write(
            'matched_angle',
            l_best_angle
        );

        apex_json.close_object;

    END IF;


EXCEPTION

    WHEN OTHERS THEN

        apex_json.open_object;

        apex_json.write(
            'success',
            false
        );

        apex_json.write(
            'status',
            'ERROR'
        );

        apex_json.write(
            'message',
            SQLERRM
        );

        apex_json.close_object;

END;