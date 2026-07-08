import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * InitialSchema — schema v1 consolidado (squash de 87 migrations históricas).
 *
 * Reproduz EXATAMENTE o schema produzido pela sequência das 87 migrations
 * anteriores (verificado por diff de pg_dump --schema-only: zero diff).
 * Gerado a partir do schema real (fonte da verdade = banco migrado), pois as
 * entities acumularam drift cosmético em relação às migrations (nomes de tipos
 * enum, nomes de índices/constraints). Manter o schema idêntico ao atual é
 * requisito: todo ambiente é descartável e recriado do zero com esta migration
 * (pnpm docker:reset + migration:run). Não há baseline de banco existente.
 */
export class InitialSchema1777743139019 implements MigrationInterface {
  name = 'InitialSchema1777743139019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public`);
    await queryRunner.query(`CREATE TYPE public.activities_status_enum AS ENUM (
    'DRAFT',
    'REQUESTED',
    'TODO',
    'DOING',
    'BLOCKED',
    'DONE'
)`);
    await queryRunner.query(`CREATE TYPE public.activity_events_type_enum AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'TITLE_CHANGED',
    'DESCRIPTION_CHANGED',
    'RESPONSIBLE_CHANGED',
    'COMMENTED',
    'DELETED'
)`);
    await queryRunner.query(`CREATE TYPE public.associate_charges_status_enum AS ENUM (
    'PENDING',
    'PAID',
    'FAILED'
)`);
    await queryRunner.query(`CREATE TYPE public.associate_subscriptions_status_enum AS ENUM (
    'ACTIVE',
    'PAST_DUE',
    'CANCELED'
)`);
    await queryRunner.query(`CREATE TYPE public.associates_status_enum AS ENUM (
    'PENDING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED'
)`);
    await queryRunner.query(`CREATE TYPE public.family_investment_enum AS ENUM (
    'BASKET_500',
    'PAYMENT_700',
    'SOCIAL',
    'NEGOTIATED'
)`);
    await queryRunner.query(`CREATE TYPE public.follow_up_access_level_enum AS ENUM (
    'ALL',
    'ADMINISTRATION'
)`);
    await queryRunner.query(`CREATE TYPE public.follow_up_type_enum AS ENUM (
    'ADMISSION',
    'READMISSION',
    'DISCHARGE',
    'EVASION',
    'MINISTRY_CHANGE',
    'RELATIVE_ADDED',
    'DOCUMENT_ATTACHED',
    'MONTHLY_CONTRIBUTION',
    'DISCIPLINE',
    'BEHAVIOR_ASSESSMENT',
    'NOTE',
    'PROMOTED_TO_SERVANT'
)`);
    await queryRunner.query(`CREATE TYPE public.house_capacity_request_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED'
)`);
    await queryRunner.query(`CREATE TYPE public.incident_severity_enum AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
)`);
    await queryRunner.query(`CREATE TYPE public.inventory_kind_enum AS ENUM (
    'STOREROOM',
    'SUPPLY_ROOM'
)`);
    await queryRunner.query(`CREATE TYPE public.messages_status_enum AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED'
)`);
    await queryRunner.query(`CREATE TYPE public.movement_type_enum AS ENUM (
    'IN',
    'OUT'
)`);
    await queryRunner.query(`CREATE TYPE public.notification_type_enum AS ENUM (
    'ADMISSION_CREATED',
    'PAYMENT_REGISTERED',
    'INCIDENT_CREATED',
    'RESIDENT_DISCHARGED',
    'RECEIVABLE_OVERDUE',
    'ROUTINE_MISSING',
    'REQUIRED_DOC_MISSING',
    'CAPACITY_CHANGE_REQUESTED',
    'CAPACITY_CHANGE_APPROVED',
    'CAPACITY_CHANGE_REJECTED',
    'CENSUS_RESIDENT_ADDED',
    'CENSUS_CONCLUDED'
)`);
    await queryRunner.query(`CREATE TYPE public.payables_category_enum AS ENUM (
    'UTILITIES',
    'SUPPLIES',
    'MAINTENANCE',
    'PAYROLL',
    'TAXES',
    'OTHER'
)`);
    await queryRunner.query(`CREATE TYPE public.payables_status_enum AS ENUM (
    'OPEN',
    'PAID'
)`);
    await queryRunner.query(`CREATE TYPE public.payment_method_enum AS ENUM (
    'CASH',
    'PIX',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'BASKET',
    'OTHER'
)`);
    await queryRunner.query(`CREATE TYPE public.receivable_status_enum AS ENUM (
    'PENDING',
    'PAID',
    'CANCELED'
)`);
    await queryRunner.query(`CREATE TYPE public.residents_gender_enum AS ENUM (
    'MALE',
    'FEMALE'
)`);
    await queryRunner.query(`CREATE TYPE public.residents_marital_status_enum AS ENUM (
    'SINGLE',
    'MARRIED',
    'DIVORCED'
)`);
    await queryRunner.query(`CREATE TYPE public.residents_status_enum AS ENUM (
    'PRE_ADMISSION',
    'ACTIVE',
    'DISCIPLINE',
    'TEMP_LEAVE',
    'DISCHARGED',
    'EVADED',
    'CENSUS_ADDED',
    'REJECTED_CENSUS'
)`);
    await queryRunner.query(`CREATE TYPE public.staff_gender_enum AS ENUM (
    'MALE',
    'FEMALE'
)`);
    await queryRunner.query(`CREATE TYPE public.staff_marital_status_enum AS ENUM (
    'SINGLE',
    'MARRIED',
    'DIVORCED'
)`);
    await queryRunner.query(`CREATE TYPE public.staff_rank_enum AS ENUM (
    'ASPIRANTE',
    'CONSAGRADO',
    'ALIANCADO'
)`);
    await queryRunner.query(`CREATE TYPE public.street_sales_type_enum AS ENUM (
    'BREAD',
    'PIZZA'
)`);
    await queryRunner.query(`CREATE TYPE public.supply_room_category_enum AS ENUM (
    'CLEANING',
    'HYGIENE',
    'PPE',
    'OFFICE',
    'OTHER'
)`);
    await queryRunner.query(`CREATE TYPE public.users_role_enum AS ENUM (
    'ADMIN',
    'COORDINATOR',
    'SERVANT',
    'RELATIVE',
    'RESIDENT'
)`);
    await queryRunner.query(`CREATE TYPE public.wishlist_items_status_enum AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED'
)`);
    await queryRunner.query(`CREATE TABLE public.activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    description text,
    status public.activities_status_enum DEFAULT 'DRAFT'::public.activities_status_enum NOT NULL,
    house_id uuid,
    responsible_staff_id uuid,
    created_by_user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.activity_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_id uuid NOT NULL,
    comment_id uuid,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_type character varying(16) NOT NULL,
    mime_type character varying(128) NOT NULL,
    size_bytes integer NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    duration_seconds integer
)`);
    await queryRunner.query(`CREATE TABLE public.activity_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_id uuid NOT NULL,
    body text NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.activity_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    activity_id uuid NOT NULL,
    type public.activity_events_type_enum NOT NULL,
    actor_user_id uuid NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.admissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    house_id uuid NOT NULL,
    ministry_id uuid,
    entry_date date,
    exit_date date,
    status character varying NOT NULL,
    health_issues character varying,
    continuous_medication character varying,
    weight integer,
    height integer,
    family_investment public.family_investment_enum,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    family_investment_amount integer,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    timer_reset_frequency character varying DEFAULT 'DAILY'::character varying NOT NULL,
    daily_usage_minutes integer DEFAULT 20 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.associate_charge_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    associate_id uuid NOT NULL,
    channel character varying NOT NULL,
    type character varying NOT NULL,
    sent_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.associate_charges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    associate_id uuid NOT NULL,
    subscription_id uuid,
    gateway_charge_id character varying,
    net_amount numeric(10,2) NOT NULL,
    fee_amount numeric(10,2) NOT NULL,
    gross_amount numeric(10,2) NOT NULL,
    status public.associate_charges_status_enum DEFAULT 'PENDING'::public.associate_charges_status_enum NOT NULL,
    due_date date NOT NULL,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.associate_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    associate_id uuid NOT NULL,
    gateway_subscription_id character varying,
    net_amount numeric(10,2) NOT NULL,
    fee_amount numeric(10,2) NOT NULL,
    gross_amount numeric(10,2) NOT NULL,
    status public.associate_subscriptions_status_enum DEFAULT 'ACTIVE'::public.associate_subscriptions_status_enum NOT NULL,
    started_at timestamp without time zone,
    canceled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.associates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    whatsapp character varying NOT NULL,
    email character varying,
    contribution_amount numeric(10,2) NOT NULL,
    due_day smallint NOT NULL,
    status public.associates_status_enum DEFAULT 'PENDING'::public.associates_status_enum NOT NULL,
    gateway_customer_id character varying,
    payment_token uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    role character varying,
    action character varying NOT NULL,
    target_type character varying,
    target_id character varying,
    http_method character varying,
    path character varying,
    ip_address character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.bible_course_class_photos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    class_id uuid NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    mime_type character varying(128) NOT NULL,
    size_bytes integer NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.bible_course_classes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    house_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying DEFAULT 'PLANNED'::character varying NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.bible_course_enrollments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    class_id uuid NOT NULL,
    resident_id uuid NOT NULL,
    status character varying DEFAULT 'ENROLLED'::character varying NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.bible_course_grades (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    enrollment_id uuid NOT NULL,
    module_id uuid NOT NULL,
    exam_grade numeric(4,2),
    work_grade numeric(4,2),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.bible_course_modules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    sequence integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.consent_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subject_type character varying NOT NULL,
    subject_id uuid NOT NULL,
    purpose character varying NOT NULL,
    granted boolean NOT NULL,
    term_version character varying,
    recorded_by_user_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.document_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    content text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    sign_at_admission boolean DEFAULT false NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.event_registrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    name character varying NOT NULL,
    contact character varying NOT NULL,
    email character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    payment_token character varying,
    payment_status character varying DEFAULT 'NONE'::character varying NOT NULL,
    amount_cents integer,
    gateway_order_id character varying,
    gateway_charge_id character varying,
    payment_method character varying
)`);
    await queryRunner.query(`CREATE TABLE public.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    description text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    location character varying,
    capacity integer,
    banner_key character varying,
    registration_opens_at timestamp with time zone,
    registration_closes_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    registration_enabled boolean DEFAULT false NOT NULL,
    registration_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    payment_enabled boolean DEFAULT false NOT NULL,
    price_cents integer,
    audience character varying DEFAULT 'PUBLIC'::character varying NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.house_capacity_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    house_id uuid NOT NULL,
    requested_general_capacity integer NOT NULL,
    requested_staff_capacity integer NOT NULL,
    previous_general_capacity integer,
    previous_staff_capacity integer,
    status public.house_capacity_request_status_enum DEFAULT 'PENDING'::public.house_capacity_request_status_enum NOT NULL,
    requested_by_id uuid NOT NULL,
    reviewed_by_id uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.house_photos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    house_id uuid NOT NULL,
    filename character varying NOT NULL,
    path character varying NOT NULL,
    url character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.house_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    house_id uuid NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.houses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    address character varying,
    city character varying,
    state character varying(2),
    coordinator_id uuid,
    phone character varying,
    general_capacity integer,
    staff_capacity integer,
    is_mother_house boolean DEFAULT false NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.incidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    date date NOT NULL,
    severity public.incident_severity_enum NOT NULL,
    description text NOT NULL,
    house_id uuid NOT NULL,
    responsible_id uuid NOT NULL,
    resident_id uuid
)`);
    await queryRunner.query(`CREATE TABLE public.inventory_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kind public.inventory_kind_enum NOT NULL,
    name character varying NOT NULL,
    unit character varying NOT NULL,
    house_id uuid NOT NULL,
    current_quantity numeric(10,3) DEFAULT 0 NOT NULL,
    weekly_average_usage numeric(10,3) DEFAULT 0 NOT NULL,
    weekly_average_calculated_at timestamp without time zone,
    weekly_average_window_start date,
    weekly_average_window_end date,
    category public.supply_room_category_enum,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT "CHK_inventory_items_weekly_average_usage_non_negative" CHECK ((weekly_average_usage >= (0)::numeric))
)`);
    await queryRunner.query(`CREATE TABLE public.inventory_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kind public.inventory_kind_enum NOT NULL,
    item_id uuid NOT NULL,
    type public.movement_type_enum NOT NULL,
    quantity numeric(10,3) NOT NULL,
    responsible_id uuid NOT NULL,
    notes text,
    date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid,
    relative_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    content text,
    status public.messages_status_enum DEFAULT 'PENDING_APPROVAL'::public.messages_status_enum NOT NULL,
    approved_by_user_id uuid,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    staff_id uuid,
    attachment_url text,
    attachment_type character varying(10),
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.ministries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    house_id uuid NOT NULL,
    leader_id uuid,
    leader_type character varying(10)
)`);
    await queryRunner.query(`CREATE TABLE public.ministry_staff (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ministry_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.ministry_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    ministry_id uuid NOT NULL,
    title character varying NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    repetition character varying(10) DEFAULT 'NONE'::character varying NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.notification_reads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    notification_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recipient_id uuid,
    recipient_role public.users_role_enum,
    house_id uuid,
    type public.notification_type_enum NOT NULL,
    title character varying NOT NULL,
    body text,
    link character varying,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.payables (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    description character varying NOT NULL,
    amount integer NOT NULL,
    due_date date NOT NULL,
    category public.payables_category_enum NOT NULL,
    supplier character varying,
    status public.payables_status_enum DEFAULT 'OPEN'::public.payables_status_enum NOT NULL,
    paid_at date,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    attachment_url character varying,
    attachment_name character varying,
    payment_receipt_url character varying,
    payment_receipt_name character varying
)`);
    await queryRunner.query(`CREATE TABLE public.receivable_product_contributions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    receivable_id uuid NOT NULL,
    inventory_item_id uuid,
    inventory_movement_id uuid,
    description text,
    quantity numeric(10,3),
    unit character varying,
    pending_detailing boolean DEFAULT false NOT NULL,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT "CHK_rpc_item_xor_description" CHECK (((inventory_item_id IS NOT NULL) <> (description IS NOT NULL)))
)`);
    await queryRunner.query(`CREATE TABLE public.relatives (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    phone character varying,
    relationship character varying,
    user_id uuid,
    resident_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    photo_url character varying,
    is_responsible boolean DEFAULT false NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.resident_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    filename character varying NOT NULL,
    file_url character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.resident_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    template_id uuid NOT NULL,
    signed_file_url character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.resident_follow_ups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    date date NOT NULL,
    type public.follow_up_type_enum NOT NULL,
    description text,
    access_level public.follow_up_access_level_enum DEFAULT 'ALL'::public.follow_up_access_level_enum NOT NULL,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    attachment_url character varying
)`);
    await queryRunner.query(`CREATE TABLE public.resident_receivables (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    reference_month date NOT NULL,
    due_date date NOT NULL,
    amount integer NOT NULL,
    family_investment public.family_investment_enum NOT NULL,
    mandatory boolean DEFAULT true NOT NULL,
    status public.receivable_status_enum DEFAULT 'PENDING'::public.receivable_status_enum NOT NULL,
    paid_at date,
    payment_method public.payment_method_enum,
    attachment_url character varying,
    notes text,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    paid_amount integer,
    paid_family_investment public.family_investment_enum
)`);
    await queryRunner.query(`CREATE TABLE public.resident_usage_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    date date NOT NULL,
    seconds_used integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.residents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    birth_date date,
    cpf character varying,
    status public.residents_status_enum DEFAULT 'PRE_ADMISSION'::public.residents_status_enum NOT NULL,
    user_id uuid,
    house_id uuid NOT NULL,
    entry_date date,
    exit_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    gender public.residents_gender_enum,
    rg character varying,
    address character varying,
    contact_phone character varying,
    marital_status public.residents_marital_status_enum,
    children integer DEFAULT 0 NOT NULL,
    occupation character varying,
    guardian_id uuid,
    education character varying,
    health_issues character varying,
    continuous_medication character varying,
    religion character varying,
    addiction character varying,
    weight integer,
    height integer,
    family_investment public.family_investment_enum,
    photo_url character varying,
    ministry_id uuid,
    email character varying,
    family_investment_amount integer,
    nationality character varying,
    city character varying,
    state character varying,
    contribution_due_day integer,
    photo_thumb_url character varying,
    contribution_exempt boolean DEFAULT false NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.routine_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    date date NOT NULL,
    description text NOT NULL,
    house_id uuid NOT NULL,
    responsible_id uuid NOT NULL,
    resident_id uuid
)`);
    await queryRunner.query(`CREATE TABLE public.staff (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    whatsapp character varying,
    user_id uuid NOT NULL,
    house_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    support_group_id uuid,
    photo_url character varying,
    rank public.staff_rank_enum,
    former_resident_id uuid,
    promoted_at date,
    birth_date date,
    cpf character varying,
    rg character varying,
    nationality character varying,
    gender public.staff_gender_enum,
    city character varying,
    state character varying,
    address character varying,
    marital_status public.staff_marital_status_enum,
    children integer DEFAULT 0 NOT NULL,
    occupation character varying,
    education character varying,
    religion character varying
)`);
    await queryRunner.query(`CREATE TABLE public.staff_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    staff_id uuid NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    mime_type character varying(128) NOT NULL,
    size_bytes integer NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.staff_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    permission_type character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.storeroom_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    unit character varying NOT NULL,
    house_id uuid NOT NULL,
    current_quantity numeric(10,3) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    weekly_average_usage numeric(10,3) DEFAULT 0 NOT NULL,
    weekly_average_calculated_at timestamp without time zone,
    weekly_average_window_start date,
    weekly_average_window_end date,
    CONSTRAINT "CHK_storeroom_items_weekly_average_usage_non_negative" CHECK ((weekly_average_usage >= (0)::numeric))
)`);
    await queryRunner.query(`CREATE TABLE public.storeroom_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    item_id uuid NOT NULL,
    type public.movement_type_enum NOT NULL,
    quantity numeric(10,3) NOT NULL,
    responsible_id uuid NOT NULL,
    notes text,
    date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.street_sales (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    house_id uuid NOT NULL,
    registered_by uuid,
    date date NOT NULL,
    type public.street_sales_type_enum NOT NULL,
    quantity integer NOT NULL,
    amount_pix integer DEFAULT 0 NOT NULL,
    amount_cash integer DEFAULT 0 NOT NULL,
    amount_card integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.supply_room_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    unit character varying NOT NULL,
    category public.supply_room_category_enum NOT NULL,
    house_id uuid NOT NULL,
    current_quantity numeric(10,3) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.supply_room_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    type public.movement_type_enum NOT NULL,
    quantity numeric(10,3) NOT NULL,
    responsible_id uuid NOT NULL,
    notes text,
    date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.support_group_checkins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    meeting_id uuid NOT NULL,
    resident_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.support_group_meetings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    support_group_id uuid NOT NULL,
    date date NOT NULL,
    notes text,
    checkin_token uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.support_group_relative_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    relative_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.support_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    church_name character varying NOT NULL,
    address character varying NOT NULL,
    coordinator_id uuid,
    day_of_week smallint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);
    await queryRunner.query(`CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying,
    password_hash character varying NOT NULL,
    role public.users_role_enum NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    must_change_password boolean DEFAULT false NOT NULL
)`);
    await queryRunner.query(`CREATE TABLE public.wishlist_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    description character varying NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    status public.wishlist_items_status_enum DEFAULT 'PENDING_APPROVAL'::public.wishlist_items_status_enum NOT NULL,
    is_removal_requested boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    approved_by_user_id uuid,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    rejection_reason text
)`);
    await queryRunner.query(`ALTER TABLE ONLY public.relatives
    ADD CONSTRAINT "PK_4c16d30b6af847a1f7286caf2c3" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.residents
    ADD CONSTRAINT "PK_4c8d0413ee0e9a4ebbf500f7365" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "PK_activities" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_attachments
    ADD CONSTRAINT "PK_activity_attachments" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_comments
    ADD CONSTRAINT "PK_activity_comments" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT "PK_activity_events" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministries
    ADD CONSTRAINT "PK_ad897fa0432df1de62b552a8706" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "PK_admissions" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associate_charge_notifications
    ADD CONSTRAINT "PK_associate_charge_notifications" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associate_charges
    ADD CONSTRAINT "PK_associate_charges" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associate_subscriptions
    ADD CONSTRAINT "PK_associate_subscriptions" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associates
    ADD CONSTRAINT "PK_associates" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_audit_logs" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.routine_entries
    ADD CONSTRAINT "PK_b351ba7f50d3e952051e97c4082" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_class_photos
    ADD CONSTRAINT "PK_bible_course_class_photos" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_classes
    ADD CONSTRAINT "PK_bible_course_classes" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_enrollments
    ADD CONSTRAINT "PK_bible_course_enrollments" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_grades
    ADD CONSTRAINT "PK_bible_course_grades" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_modules
    ADD CONSTRAINT "PK_bible_course_modules" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT "PK_consent_records" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT "PK_document_templates" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.houses
    ADD CONSTRAINT "PK_ee6cacb502a4b8590005eb3dc8d" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT "PK_event_registrations" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.events
    ADD CONSTRAINT "PK_events" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.house_capacity_requests
    ADD CONSTRAINT "PK_house_capacity_requests" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.house_photos
    ADD CONSTRAINT "PK_house_photos" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.house_rules
    ADD CONSTRAINT "PK_house_rules" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT "PK_inventory_items" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "PK_inventory_movements" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "PK_messages" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministry_staff
    ADD CONSTRAINT "PK_ministry_staff" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministry_tasks
    ADD CONSTRAINT "PK_ministry_tasks" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT "PK_notification_reads" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_notifications" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.payables
    ADD CONSTRAINT "PK_payables" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.receivable_product_contributions
    ADD CONSTRAINT "PK_receivable_product_contributions" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_attachments
    ADD CONSTRAINT "PK_resident_attachments" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_documents
    ADD CONSTRAINT "PK_resident_documents" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_follow_ups
    ADD CONSTRAINT "PK_resident_follow_ups" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_receivables
    ADD CONSTRAINT "PK_resident_receivables" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_usage_sessions
    ADD CONSTRAINT "PK_resident_usage_sessions" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff_attachments
    ADD CONSTRAINT "PK_staff_attachments" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.storeroom_items
    ADD CONSTRAINT "PK_storeroom_items" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.storeroom_movements
    ADD CONSTRAINT "PK_storeroom_movements" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.street_sales
    ADD CONSTRAINT "PK_street_sales" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_checkins
    ADD CONSTRAINT "PK_support_group_checkins" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_meetings
    ADD CONSTRAINT "PK_support_group_meetings" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_groups
    ADD CONSTRAINT "PK_support_groups" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT "PK_wishlist_items" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.relatives
    ADD CONSTRAINT "REL_4cbde7eae8b44b16095dade8ed" UNIQUE (user_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "REL_cec9365d9fc3a3409158b645f2" UNIQUE (user_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.residents
    ADD CONSTRAINT "REL_e7e6da6e7bccd71a8c7d65469c" UNIQUE (user_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associates
    ADD CONSTRAINT "UQ_associates_payment_token" UNIQUE (payment_token)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_enrollments
    ADD CONSTRAINT "UQ_bible_course_enrollments" UNIQUE (class_id, resident_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_grades
    ADD CONSTRAINT "UQ_bible_course_grades" UNIQUE (enrollment_id, module_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT "UQ_document_templates_name" UNIQUE (name)`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministry_staff
    ADD CONSTRAINT "UQ_ministry_staff" UNIQUE (ministry_id, staff_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_documents
    ADD CONSTRAINT "UQ_resident_documents_resident_template" UNIQUE (resident_id, template_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_usage_sessions
    ADD CONSTRAINT "UQ_resident_usage_sessions_resident_date" UNIQUE (resident_id, date)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_checkins
    ADD CONSTRAINT "UQ_support_group_checkins" UNIQUE (meeting_id, resident_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_meetings
    ADD CONSTRAINT "UQ_support_group_meetings_token" UNIQUE (checkin_token)`);
    await queryRunner.query(`ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_staff_id_permission_type_key UNIQUE (staff_id, permission_type)`);
    await queryRunner.query(`ALTER TABLE ONLY public.supply_room_items
    ADD CONSTRAINT supply_room_items_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.supply_room_movements
    ADD CONSTRAINT supply_room_movements_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_relative_checkins
    ADD CONSTRAINT support_group_relative_checkins_meeting_id_relative_id_key UNIQUE (meeting_id, relative_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_relative_checkins
    ADD CONSTRAINT support_group_relative_checkins_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX "IDX_activities_house_id" ON public.activities USING btree (house_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_activities_responsible_staff_id" ON public.activities USING btree (responsible_staff_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_activities_status" ON public.activities USING btree (status)`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_attachments_activity_id" ON public.activity_attachments USING btree (activity_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_attachments_comment_id" ON public.activity_attachments USING btree (comment_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_comments_activity_id" ON public.activity_comments USING btree (activity_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_events_activity_id" ON public.activity_events USING btree (activity_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON public.audit_logs USING btree (action)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_target_id" ON public.audit_logs USING btree (target_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON public.audit_logs USING btree (user_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_bible_course_class_photos_class_id" ON public.bible_course_class_photos USING btree (class_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_consent_records_subject" ON public.consent_records USING btree (subject_type, subject_id, purpose)`);
    await queryRunner.query(`CREATE INDEX "IDX_event_registrations_event_id" ON public.event_registrations USING btree (event_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_events_start_at" ON public.events USING btree (start_at)`);
    await queryRunner.query(`CREATE INDEX "IDX_follow_ups_resident_id" ON public.resident_follow_ups USING btree (resident_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_house_capacity_requests_house_id" ON public.house_capacity_requests USING btree (house_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_inventory_items_kind" ON public.inventory_items USING btree (kind)`);
    await queryRunner.query(`CREATE INDEX "IDX_inventory_items_kind_house" ON public.inventory_items USING btree (kind, house_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_inventory_movements_kind" ON public.inventory_movements USING btree (kind)`);
    await queryRunner.query(`CREATE INDEX "IDX_inventory_movements_type_date_item" ON public.inventory_movements USING btree (type, date, item_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_house_id" ON public.notifications USING btree (house_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_recipient_id" ON public.notifications USING btree (recipient_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_recipient_role" ON public.notifications USING btree (recipient_role)`);
    await queryRunner.query(`CREATE INDEX "IDX_payables_due_date" ON public.payables USING btree (due_date)`);
    await queryRunner.query(`CREATE INDEX "IDX_payables_status" ON public.payables USING btree (status)`);
    await queryRunner.query(`CREATE INDEX "IDX_receivables_resident_id" ON public.resident_receivables USING btree (resident_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_rpc_inventory_item" ON public.receivable_product_contributions USING btree (inventory_item_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_rpc_receivable" ON public.receivable_product_contributions USING btree (receivable_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_staff_attachments_staff_id" ON public.staff_attachments USING btree (staff_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_storeroom_movements_type_date_item" ON public.storeroom_movements USING btree (type, date, item_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_associate_charges_gateway_charge_id" ON public.associate_charges USING btree (gateway_charge_id) WHERE (gateway_charge_id IS NOT NULL)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_house_capacity_requests_pending_per_house" ON public.house_capacity_requests USING btree (house_id) WHERE ((status = 'PENDING'::public.house_capacity_request_status_enum) AND (deleted_at IS NULL))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_houses_mother" ON public.houses USING btree (is_mother_house) WHERE (is_mother_house = true)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_notification_reads_notification_user" ON public.notification_reads USING btree (notification_id, user_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_receivables_resident_month" ON public.resident_receivables USING btree (resident_id, reference_month) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_relatives_responsible_per_resident" ON public.relatives USING btree (resident_id) WHERE ((is_responsible = true) AND (deleted_at IS NULL))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email_active" ON public.users USING btree (email) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_event_registrations_gateway_charge_id ON public.event_registrations USING btree (gateway_charge_id) WHERE (gateway_charge_id IS NOT NULL)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_event_registrations_payment_token ON public.event_registrations USING btree (payment_token) WHERE (payment_token IS NOT NULL)`);
    await queryRunner.query(`ALTER TABLE ONLY public.relatives
    ADD CONSTRAINT "FK_4cbde7eae8b44b16095dade8ed9" FOREIGN KEY (user_id) REFERENCES public.users(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.relatives
    ADD CONSTRAINT "FK_50ba8691dfc920a91f159f385a0" FOREIGN KEY (resident_id) REFERENCES public.residents(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.residents
    ADD CONSTRAINT "FK_72d68158de1f2018938e9603005" FOREIGN KEY (house_id) REFERENCES public.houses(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "FK_activities_created_by" FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "FK_activities_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "FK_activities_responsible" FOREIGN KEY (responsible_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_attachments
    ADD CONSTRAINT "FK_activity_attachments_activity" FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_attachments
    ADD CONSTRAINT "FK_activity_attachments_comment" FOREIGN KEY (comment_id) REFERENCES public.activity_comments(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_attachments
    ADD CONSTRAINT "FK_activity_attachments_created_by" FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_comments
    ADD CONSTRAINT "FK_activity_comments_activity" FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_comments
    ADD CONSTRAINT "FK_activity_comments_created_by" FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT "FK_activity_events_activity" FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT "FK_activity_events_actor" FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_admissions_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.associate_charge_notifications
    ADD CONSTRAINT "FK_associate_charge_notifications_associate" FOREIGN KEY (associate_id) REFERENCES public.associates(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associate_charges
    ADD CONSTRAINT "FK_associate_charges_associate" FOREIGN KEY (associate_id) REFERENCES public.associates(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associate_charges
    ADD CONSTRAINT "FK_associate_charges_subscription" FOREIGN KEY (subscription_id) REFERENCES public.associate_subscriptions(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.associate_subscriptions
    ADD CONSTRAINT "FK_associate_subscriptions_associate" FOREIGN KEY (associate_id) REFERENCES public.associates(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_class_photos
    ADD CONSTRAINT "FK_bible_course_class_photos_class" FOREIGN KEY (class_id) REFERENCES public.bible_course_classes(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_class_photos
    ADD CONSTRAINT "FK_bible_course_class_photos_created_by" FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_classes
    ADD CONSTRAINT "FK_bible_course_classes_house" FOREIGN KEY (house_id) REFERENCES public.houses(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_enrollments
    ADD CONSTRAINT "FK_bible_course_enrollments_class" FOREIGN KEY (class_id) REFERENCES public.bible_course_classes(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_enrollments
    ADD CONSTRAINT "FK_bible_course_enrollments_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_grades
    ADD CONSTRAINT "FK_bible_course_grades_enrollment" FOREIGN KEY (enrollment_id) REFERENCES public.bible_course_enrollments(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_grades
    ADD CONSTRAINT "FK_bible_course_grades_module" FOREIGN KEY (module_id) REFERENCES public.bible_course_modules(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "FK_cec9365d9fc3a3409158b645f2e" FOREIGN KEY (user_id) REFERENCES public.users(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "FK_d5c355c41739991f9ebda9b87b2" FOREIGN KEY (house_id) REFERENCES public.houses(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.residents
    ADD CONSTRAINT "FK_e7e6da6e7bccd71a8c7d65469cc" FOREIGN KEY (user_id) REFERENCES public.users(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT "FK_event_registrations_event" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_follow_ups
    ADD CONSTRAINT "FK_follow_ups_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_follow_ups
    ADD CONSTRAINT "FK_follow_ups_staff" FOREIGN KEY (created_by_id) REFERENCES public.staff(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.house_capacity_requests
    ADD CONSTRAINT "FK_house_capacity_requests_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.house_capacity_requests
    ADD CONSTRAINT "FK_house_capacity_requests_requested_by" FOREIGN KEY (requested_by_id) REFERENCES public.staff(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.house_photos
    ADD CONSTRAINT "FK_house_photos_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.house_rules
    ADD CONSTRAINT "FK_house_rules_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.houses
    ADD CONSTRAINT "FK_houses_coordinator" FOREIGN KEY (coordinator_id) REFERENCES public.staff(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "FK_incidents_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "FK_incidents_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "FK_incidents_responsible" FOREIGN KEY (responsible_id) REFERENCES public.staff(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT "FK_inventory_items_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "FK_inventory_movements_item" FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT "FK_inventory_movements_responsible" FOREIGN KEY (responsible_id) REFERENCES public.staff(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "FK_messages_relative" FOREIGN KEY (relative_id) REFERENCES public.relatives(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "FK_messages_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.messages
    ADD CONSTRAINT "FK_messages_sender" FOREIGN KEY (sender_user_id) REFERENCES public.users(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministries
    ADD CONSTRAINT "FK_ministries_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministry_staff
    ADD CONSTRAINT "FK_ministry_staff_ministry" FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministry_staff
    ADD CONSTRAINT "FK_ministry_staff_staff" FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.ministry_tasks
    ADD CONSTRAINT "FK_ministry_tasks_ministry" FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT "FK_notification_reads_notification" FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_receivables
    ADD CONSTRAINT "FK_receivables_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_receivables
    ADD CONSTRAINT "FK_receivables_staff" FOREIGN KEY (created_by_id) REFERENCES public.staff(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_attachments
    ADD CONSTRAINT "FK_resident_attachments_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_documents
    ADD CONSTRAINT "FK_resident_documents_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_documents
    ADD CONSTRAINT "FK_resident_documents_template" FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.resident_usage_sessions
    ADD CONSTRAINT "FK_resident_usage_sessions_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.residents
    ADD CONSTRAINT "FK_residents_guardian" FOREIGN KEY (guardian_id) REFERENCES public.relatives(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.residents
    ADD CONSTRAINT "FK_residents_ministry" FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.routine_entries
    ADD CONSTRAINT "FK_routine_entries_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.routine_entries
    ADD CONSTRAINT "FK_routine_entries_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.routine_entries
    ADD CONSTRAINT "FK_routine_entries_responsible" FOREIGN KEY (responsible_id) REFERENCES public.staff(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.receivable_product_contributions
    ADD CONSTRAINT "FK_rpc_created_by" FOREIGN KEY (created_by_id) REFERENCES public.staff(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.receivable_product_contributions
    ADD CONSTRAINT "FK_rpc_inventory_item" FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.receivable_product_contributions
    ADD CONSTRAINT "FK_rpc_inventory_movement" FOREIGN KEY (inventory_movement_id) REFERENCES public.inventory_movements(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.receivable_product_contributions
    ADD CONSTRAINT "FK_rpc_receivable" FOREIGN KEY (receivable_id) REFERENCES public.resident_receivables(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff_attachments
    ADD CONSTRAINT "FK_staff_attachments_created_by" FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff_attachments
    ADD CONSTRAINT "FK_staff_attachments_staff" FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff
    ADD CONSTRAINT "FK_staff_former_resident" FOREIGN KEY (former_resident_id) REFERENCES public.residents(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.storeroom_items
    ADD CONSTRAINT "FK_storeroom_items_house" FOREIGN KEY (house_id) REFERENCES public.houses(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.storeroom_movements
    ADD CONSTRAINT "FK_storeroom_movements_item" FOREIGN KEY (item_id) REFERENCES public.storeroom_items(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.storeroom_movements
    ADD CONSTRAINT "FK_storeroom_movements_responsible" FOREIGN KEY (responsible_id) REFERENCES public.staff(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE ONLY public.street_sales
    ADD CONSTRAINT "FK_street_sales_house" FOREIGN KEY (house_id) REFERENCES public.houses(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.street_sales
    ADD CONSTRAINT "FK_street_sales_staff" FOREIGN KEY (registered_by) REFERENCES public.staff(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_checkins
    ADD CONSTRAINT "FK_support_group_checkins_meeting" FOREIGN KEY (meeting_id) REFERENCES public.support_group_meetings(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_checkins
    ADD CONSTRAINT "FK_support_group_checkins_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_meetings
    ADD CONSTRAINT "FK_support_group_meetings_group" FOREIGN KEY (support_group_id) REFERENCES public.support_groups(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_groups
    ADD CONSTRAINT "FK_support_groups_coordinator" FOREIGN KEY (coordinator_id) REFERENCES public.staff(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT "FK_wishlist_items_created_by" FOREIGN KEY (created_by_user_id) REFERENCES public.users(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT "FK_wishlist_items_resident" FOREIGN KEY (resident_id) REFERENCES public.residents(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_support_group_id_fkey FOREIGN KEY (support_group_id) REFERENCES public.support_groups(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE ONLY public.supply_room_items
    ADD CONSTRAINT supply_room_items_house_id_fkey FOREIGN KEY (house_id) REFERENCES public.houses(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.supply_room_movements
    ADD CONSTRAINT supply_room_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.supply_room_items(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.supply_room_movements
    ADD CONSTRAINT supply_room_movements_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES public.staff(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.support_group_relative_checkins
    ADD CONSTRAINT support_group_relative_checkins_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.support_group_meetings(id) ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wishlist_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_groups" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_group_relative_checkins" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_group_meetings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_group_checkins" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "supply_room_movements" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "supply_room_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "street_sales" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "storeroom_movements" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "storeroom_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staff" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "routine_entries" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "residents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_usage_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_receivables" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_follow_ups" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_documents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "relatives" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "receivable_product_contributions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payables" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_reads" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ministry_tasks" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ministry_staff" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ministries" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_movements" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incidents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "houses" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "house_rules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "house_photos" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "house_capacity_requests" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_registrations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_templates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "consent_records" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_modules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_grades" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_enrollments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_classes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bible_course_class_photos" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "associates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "associate_subscriptions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "associate_charges" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "associate_charge_notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_comments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activities" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."wishlist_items_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."supply_room_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."street_sales_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."staff_rank_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."staff_marital_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."staff_gender_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."residents_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."residents_marital_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."residents_gender_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."receivable_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payment_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payables_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payables_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."notification_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."movement_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."messages_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."inventory_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."incident_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."house_capacity_request_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."follow_up_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."follow_up_access_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."family_investment_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."associates_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."associate_subscriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."associate_charges_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."activity_events_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."activities_status_enum"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
