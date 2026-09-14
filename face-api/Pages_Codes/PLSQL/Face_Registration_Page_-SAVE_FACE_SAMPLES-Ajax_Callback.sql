DECLARE
    l_user_id          FA_USERS.ID%TYPE;
    l_face_profile_id  FA_FACE_PROFILES.FACE_PROFILE_ID%TYPE;

    l_center CLOB := APEX_APPLICATION.G_X01;
    l_left   CLOB := APEX_APPLICATION.G_X02;
    l_right  CLOB := APEX_APPLICATION.G_X03;
    l_up     CLOB := APEX_APPLICATION.G_X04;
    l_down   CLOB := APEX_APPLICATION.G_X05;

    l_g_user VARCHAR2(255);


    FUNCTION is_valid_descriptor(
        p_descriptor CLOB
    ) RETURN BOOLEAN
    IS
        l_count NUMBER;
    BEGIN

        IF p_descriptor IS NULL THEN
            RETURN FALSE;
        END IF;

        SELECT COUNT(*)
        INTO l_count
        FROM JSON_TABLE(
            p_descriptor,
            '$[*]'
            COLUMNS (
                val NUMBER PATH '$'
            )
        );

        RETURN l_count = 128;

    EXCEPTION
        WHEN OTHERS THEN
            RETURN FALSE;
    END;


    PROCEDURE insert_sample(
        p_profile_id NUMBER,
        p_angle      VARCHAR2,
        p_descriptor CLOB
    )
    IS
    BEGIN

        INSERT INTO FA_FACE_SAMPLES
        (
            FACE_PROFILE_ID,
            ANGLE_CODE,
            FACE_DESCRIPTOR,
            CAPTURED_AT
        )
        VALUES
        (
            p_profile_id,
            p_angle,
            p_descriptor,
            SYSTIMESTAMP
        );

    END;

BEGIN

    /* 1. Current APEX user */

    l_g_user := TRIM(APEX_APPLICATION.G_USER);

    IF l_g_user IS NULL
       OR UPPER(l_g_user) = 'NOBODY'
    THEN

        RAISE_APPLICATION_ERROR(
            -20500,
            'Authenticated APEX user was not found.'
        );

    END IF;


    /* 2. Validate descriptors */

    IF NOT is_valid_descriptor(l_center) THEN
        RAISE_APPLICATION_ERROR(
            -20501,
            'Invalid CENTER descriptor.'
        );
    END IF;

    IF NOT is_valid_descriptor(l_left) THEN
        RAISE_APPLICATION_ERROR(
            -20502,
            'Invalid LEFT descriptor.'
        );
    END IF;

    IF NOT is_valid_descriptor(l_right) THEN
        RAISE_APPLICATION_ERROR(
            -20503,
            'Invalid RIGHT descriptor.'
        );
    END IF;

    IF NOT is_valid_descriptor(l_up) THEN
        RAISE_APPLICATION_ERROR(
            -20504,
            'Invalid UP descriptor.'
        );
    END IF;

    IF NOT is_valid_descriptor(l_down) THEN
        RAISE_APPLICATION_ERROR(
            -20505,
            'Invalid DOWN descriptor.'
        );
    END IF;


    /* 3. Find active user */

    BEGIN

        SELECT ID
        INTO l_user_id
        FROM FA_USERS
        WHERE ACCOUNT_STATUS = 1
          AND (
                UPPER(USERNAME) = UPPER(l_g_user)
                OR
                LOWER(EMAIL) = LOWER(l_g_user)
              )
        FETCH FIRST 1 ROW ONLY;

    EXCEPTION

        WHEN NO_DATA_FOUND THEN

            RAISE_APPLICATION_ERROR(
                -20510,
                'Active user was not found. G_USER = [' ||
                l_g_user ||
                ']'
            );

    END;


    /* 4. Find or create face profile */

    BEGIN

        SELECT FACE_PROFILE_ID
        INTO l_face_profile_id
        FROM FA_FACE_PROFILES
        WHERE USER_ID = l_user_id;

    EXCEPTION

        WHEN NO_DATA_FOUND THEN

            INSERT INTO FA_FACE_PROFILES
            (
                USER_ID,
                CREATED_AT
            )
            VALUES
            (
                l_user_id,
                SYSTIMESTAMP
            )
            RETURNING FACE_PROFILE_ID
            INTO l_face_profile_id;

    END;


    /* 5. Delete previous samples */

    DELETE FROM FA_FACE_SAMPLES
    WHERE FACE_PROFILE_ID = l_face_profile_id;


    /* 6. Insert five samples */

    insert_sample(
        l_face_profile_id,
        'CENTER',
        l_center
    );

    insert_sample(
        l_face_profile_id,
        'LEFT',
        l_left
    );

    insert_sample(
        l_face_profile_id,
        'RIGHT',
        l_right
    );

    insert_sample(
        l_face_profile_id,
        'UP',
        l_up
    );

    insert_sample(
        l_face_profile_id,
        'DOWN',
        l_down
    );


    /* 7. Update profile timestamp */

    UPDATE FA_FACE_PROFILES
    SET UPDATED_AT = SYSTIMESTAMP
    WHERE FACE_PROFILE_ID = l_face_profile_id;


    /* 8. Commit */

    COMMIT;


    /* 9. JSON response */

    APEX_JSON.OPEN_OBJECT;

    APEX_JSON.WRITE(
        'success',
        TRUE
    );

    APEX_JSON.WRITE(
        'message',
        'All five face samples were saved successfully.'
    );

    APEX_JSON.WRITE(
        'samples',
        5
    );

    APEX_JSON.WRITE(
        'user_id',
        l_user_id
    );

    APEX_JSON.WRITE(
        'face_profile_id',
        l_face_profile_id
    );

    APEX_JSON.CLOSE_OBJECT;


EXCEPTION

    WHEN OTHERS THEN

        ROLLBACK;

        APEX_JSON.OPEN_OBJECT;

        APEX_JSON.WRITE(
            'success',
            FALSE
        );

        APEX_JSON.WRITE(
            'message',
            SQLERRM
        );

        APEX_JSON.WRITE(
            'error_code',
            SQLCODE
        );

        APEX_JSON.CLOSE_OBJECT;

END;