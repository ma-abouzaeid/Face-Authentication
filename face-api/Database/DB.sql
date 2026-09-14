/* ============================================================
   FACE AUTHENTICATION SYSTEM
   COMPLETE DATABASE SCRIPT
   ============================================================

   Objects:
   1. FA_USERS
   2. FA_USERS_SEQ
   3. HASH_PASSWORD
   4. AUTHENTICATE_USER
   5. BI_USERS
   6. BU_USERS
   7. FA_FACE_PROFILES
   8. FA_FACE_SAMPLES

   ============================================================ */


/* ============================================================
   OPTIONAL CLEANUP
   ============================================================

   WARNING:
   Uncomment ONLY when recreating the database from scratch.
   This will delete existing data.

-- DROP TABLE FA_FACE_SAMPLES CASCADE CONSTRAINTS;
-- DROP TABLE FA_FACE_PROFILES CASCADE CONSTRAINTS;
-- DROP TABLE FA_USERS CASCADE CONSTRAINTS;
-- DROP SEQUENCE FA_USERS_SEQ;

   ============================================================ */



/* ============================================================
   1. USERS TABLE
   ============================================================ */

CREATE TABLE FA_USERS
(
    ID NUMBER
        NOT NULL ENABLE,

    USERNAME VARCHAR2(255),

    PASSWORD VARCHAR2(255),

    EMAIL VARCHAR2(255),

    ACCOUNT_STATUS NUMBER(1,0),

    CONSTRAINT USERS_PK
        PRIMARY KEY (ID)
        USING INDEX ENABLE,

    CONSTRAINT USERS_UK1
        UNIQUE (USERNAME)
        USING INDEX ENABLE,

    CONSTRAINT USERS_UK2
        UNIQUE (EMAIL)
        USING INDEX ENABLE
);



/* ============================================================
   2. USERS SEQUENCE
   ============================================================ */

CREATE SEQUENCE FA_USERS_SEQ
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;



/* ============================================================
   3. HASH_PASSWORD FUNCTION
   ============================================================ */

CREATE OR REPLACE FUNCTION HASH_PASSWORD
(
    p_user_name IN VARCHAR2,
    p_password  IN VARCHAR2
)
RETURN VARCHAR2
IS
    l_user     FA_USERS.USERNAME%TYPE := UPPER(p_user_name);
    l_password VARCHAR2(255);
BEGIN

    /*
     * SHA-512 one-way hash
     */

    SELECT STANDARD_HASH(
               p_user_name || p_password,
               'SHA512'
           )
    INTO l_password
    FROM dual;

    RETURN l_password;

END HASH_PASSWORD;
/
 


/* ============================================================
   4. BEFORE INSERT TRIGGER
   ============================================================ */

CREATE OR REPLACE EDITIONABLE TRIGGER BI_USERS

BEFORE INSERT
ON FA_USERS
FOR EACH ROW

BEGIN

    /*
     * Generate primary key
     */

    SELECT FA_USERS_SEQ.NEXTVAL
    INTO :NEW.ID
    FROM dual;


    /*
     * Store username in uppercase
     */

    :NEW.USERNAME :=
        UPPER(:NEW.USERNAME);


    /*
     * Hash password
     */

    :NEW.PASSWORD :=
        HASH_PASSWORD(
            UPPER(:NEW.USERNAME),
            :NEW.PASSWORD
        );

END;
/
 

ALTER TRIGGER BI_USERS ENABLE;



/* ============================================================
   5. BEFORE UPDATE TRIGGER
   ============================================================ */

CREATE OR REPLACE EDITIONABLE TRIGGER BU_USERS

BEFORE UPDATE
ON FA_USERS
FOR EACH ROW

BEGIN

    /*
     * Store username in uppercase
     */

    :NEW.USERNAME :=
        UPPER(:NEW.USERNAME);


    /*
     * If password was changed,
     * hash the new password.
     */

    IF :NEW.PASSWORD IS NOT NULL THEN

        :NEW.PASSWORD :=
            HASH_PASSWORD(
                UPPER(:NEW.USERNAME),
                :NEW.PASSWORD
            );

    ELSE

        /*
         * Preserve the old password
         */

        :NEW.PASSWORD :=
            :OLD.PASSWORD;

    END IF;

END;
/
 

ALTER TRIGGER BU_USERS ENABLE;



/* ============================================================
   6. AUTHENTICATE_USER FUNCTION
   ============================================================ */

CREATE OR REPLACE FUNCTION AUTHENTICATE_USER
(
    p_username IN VARCHAR2,
    p_password IN VARCHAR2
)
RETURN BOOLEAN
IS

    uc_username         VARCHAR2(255) := UPPER(p_username);

    lc_email            VARCHAR2(255) := LOWER(p_username);

    login_with_email    NUMBER := 0;

    login_with_username NUMBER := 0;

    retrieved_pwd       VARCHAR2(255);

    encrypted_pwd       VARCHAR2(255);

    v_verification      NUMBER;

BEGIN

    /*
     * Check Username
     */

    SELECT COUNT(*)
    INTO login_with_username
    FROM FA_USERS
    WHERE USERNAME = uc_username;


    /*
     * Check Email
     */

    SELECT COUNT(*)
    INTO login_with_email
    FROM FA_USERS
    WHERE EMAIL = lc_email;


    /*
     * User does not exist
     */

    IF login_with_email = 0
       AND login_with_username = 0
    THEN

        RAISE_APPLICATION_ERROR(
            -20323,
            'User does not exist'
        );

        RETURN FALSE;

    END IF;


    /*
     * Check account status
     */

    SELECT ACCOUNT_STATUS
    INTO v_verification
    FROM FA_USERS
    WHERE EMAIL = lc_email
       OR USERNAME = uc_username;


    IF v_verification = 0 THEN

        RAISE_APPLICATION_ERROR(
            -20343,
            'Your email is not verified yet or you have just reset your password. Please check your email for further instructions.'
        );

        RETURN FALSE;

    END IF;


    /*
     * Get stored password
     */

    SELECT PASSWORD
    INTO retrieved_pwd
    FROM FA_USERS
    WHERE USERNAME = uc_username
       OR EMAIL = lc_email;


    /*
     * Hash entered password
     */

    SELECT HASH_PASSWORD(
               p_username,
               p_password
           )
    INTO encrypted_pwd
    FROM dual;


    /*
     * Compare passwords
     */

    IF retrieved_pwd = encrypted_pwd THEN

        RETURN TRUE;

    ELSE

        RAISE_APPLICATION_ERROR(
            -20333,
            'Incorrect password'
        );

        RETURN FALSE;

    END IF;

END AUTHENTICATE_USER;
/
 



/* ============================================================
   7. FACE PROFILES TABLE
   ============================================================ */

CREATE TABLE FA_FACE_PROFILES
(
    FACE_PROFILE_ID NUMBER
        GENERATED BY DEFAULT AS IDENTITY
        MINVALUE 1
        MAXVALUE 9999999999999999999999999999
        INCREMENT BY 1
        START WITH 1
        CACHE 20
        NOORDER
        NOCYCLE
        NOKEEP
        NOSCALE
        NOT NULL ENABLE,

    USER_ID NUMBER
        NOT NULL ENABLE,

    CREATED_AT TIMESTAMP(6)
        DEFAULT SYSTIMESTAMP
        NOT NULL ENABLE,

    UPDATED_AT TIMESTAMP(6),

    CONSTRAINT FA_FACE_PROFILES_PK
        PRIMARY KEY (FACE_PROFILE_ID)
        USING INDEX ENABLE,

    CONSTRAINT FA_FACE_PROFILES_UK
        UNIQUE (USER_ID)
        USING INDEX ENABLE
);



/* ============================================================
   8. FACE PROFILES FOREIGN KEY
   ============================================================ */

ALTER TABLE FA_FACE_PROFILES

ADD CONSTRAINT FA_FACE_PROFILES_FK

FOREIGN KEY (USER_ID)

REFERENCES FA_USERS (ID)

ENABLE;



/* ============================================================
   9. FACE SAMPLES TABLE
   ============================================================ */

CREATE TABLE FA_FACE_SAMPLES
(
    FACE_SAMPLE_ID NUMBER
        GENERATED BY DEFAULT AS IDENTITY
        MINVALUE 1
        MAXVALUE 9999999999999999999999999999
        INCREMENT BY 1
        START WITH 1
        CACHE 20
        NOORDER
        NOCYCLE
        NOKEEP
        NOSCALE
        NOT NULL ENABLE,

    FACE_PROFILE_ID NUMBER
        NOT NULL ENABLE,

    ANGLE_CODE VARCHAR2(20)
        NOT NULL ENABLE,

    FACE_DESCRIPTOR CLOB
        NOT NULL ENABLE,

    CAPTURED_AT TIMESTAMP(6)
        DEFAULT SYSTIMESTAMP
        NOT NULL ENABLE,

    CONSTRAINT FA_FACE_SAMPLES_PK
        PRIMARY KEY (FACE_SAMPLE_ID)
        USING INDEX ENABLE,

    CONSTRAINT FA_FACE_SAMPLES_UK
        UNIQUE
        (
            FACE_PROFILE_ID,
            ANGLE_CODE
        )
        USING INDEX ENABLE,

    CONSTRAINT FA_FACE_SAMPLES_CHK

        CHECK
        (
            ANGLE_CODE IN
            (
                'CENTER',
                'LEFT',
                'RIGHT',
                'UP',
                'DOWN'
            )
        )

        ENABLE
);



/* ============================================================
   10. FACE SAMPLES FOREIGN KEY
   ============================================================ */

ALTER TABLE FA_FACE_SAMPLES

ADD CONSTRAINT FA_FACE_SAMPLES_FK

FOREIGN KEY (FACE_PROFILE_ID)

REFERENCES FA_FACE_PROFILES (FACE_PROFILE_ID)

ON DELETE CASCADE

ENABLE;



/* ============================================================
   11. VERIFICATION QUERIES
   ============================================================ */


/* Check tables */

SELECT
    TABLE_NAME
FROM USER_TABLES
WHERE TABLE_NAME IN
(
    'FA_USERS',
    'FA_FACE_PROFILES',
    'FA_FACE_SAMPLES'
)
ORDER BY TABLE_NAME;



/* Check columns */

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    DATA_LENGTH,
    NULLABLE
FROM USER_TAB_COLUMNS
WHERE TABLE_NAME IN
(
    'FA_USERS',
    'FA_FACE_PROFILES',
    'FA_FACE_SAMPLES'
)
ORDER BY
    TABLE_NAME,
    COLUMN_ID;



/* Check constraints */

SELECT
    CONSTRAINT_NAME,
    TABLE_NAME,
    CONSTRAINT_TYPE,
    STATUS
FROM USER_CONSTRAINTS
WHERE TABLE_NAME IN
(
    'FA_USERS',
    'FA_FACE_PROFILES',
    'FA_FACE_SAMPLES'
)
ORDER BY
    TABLE_NAME,
    CONSTRAINT_NAME;



/* ============================================================
   FINAL DATABASE RELATIONSHIP
   ============================================================

   FA_USERS
       |
       | 1 : 1
       v
   FA_FACE_PROFILES
       |
       | 1 : N
       v
   FA_FACE_SAMPLES


   FACE_SAMPLES:
       CENTER
       LEFT
       RIGHT
       UP
       DOWN

   ============================================================ */