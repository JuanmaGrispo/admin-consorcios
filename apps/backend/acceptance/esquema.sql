-- Esquema public sin datos, exportado desde la base fuente. Regenerar con acceptance/exportar-esquema.cjs.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: canal_notificacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.canal_notificacion AS ENUM (
    'EMAIL',
    'WHATSAPP',
    'PUSH'
);


--
-- Name: categoria_notificacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.categoria_notificacion AS ENUM (
    'BOLETAS',
    'VENCIMIENTOS',
    'RECLAMOS_RESERVAS',
    'COMUNICADOS'
);


--
-- Name: concepto_pago; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.concepto_pago AS ENUM (
    'EXPENSA',
    'SENA_RESERVA'
);


--
-- Name: criterio_desempate; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.criterio_desempate AS ENUM (
    'RECHAZADA',
    'APROBADA'
);


--
-- Name: criterio_prorrateo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.criterio_prorrateo AS ENUM (
    'COEFICIENTE',
    'PARTES_IGUALES'
);


--
-- Name: estado_asamblea; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_asamblea AS ENUM (
    'BORRADOR',
    'CONVOCADA',
    'EN_CURSO',
    'CERRADA',
    'CERRADA_SIN_QUORUM'
);


--
-- Name: estado_asistencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_asistencia AS ENUM (
    'ASISTE',
    'NO_ASISTE',
    'SIN_RESPONDER',
    'CON_PODER'
);


--
-- Name: estado_boleta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_boleta AS ENUM (
    'PENDIENTE',
    'PARCIAL',
    'PAGADA',
    'VENCIDA'
);


--
-- Name: estado_envio; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_envio AS ENUM (
    'PENDIENTE',
    'ENVIADO',
    'FALLIDO'
);


--
-- Name: estado_liquidacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_liquidacion AS ENUM (
    'BORRADOR',
    'PRORRATEO',
    'PREVISUALIZACION',
    'EMITIDA',
    'CERRADA'
);


--
-- Name: estado_pago; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_pago AS ENUM (
    'PENDIENTE',
    'APROBADO',
    'RECHAZADO',
    'REINTEGRADO'
);


--
-- Name: estado_reclamo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_reclamo AS ENUM (
    'NUEVO',
    'EN_CURSO',
    'ESPERANDO_PROVEEDOR',
    'RESUELTO'
);


--
-- Name: estado_reserva; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_reserva AS ENUM (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA',
    'CANCELADA',
    'FINALIZADA'
);


--
-- Name: estado_votacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_votacion AS ENUM (
    'BORRADOR',
    'ABIERTA',
    'CERRADA'
);


--
-- Name: forma_conteo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forma_conteo AS ENUM (
    'POR_COEFICIENTE',
    'POR_UNIDAD'
);


--
-- Name: mayoria_requerida; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mayoria_requerida AS ENUM (
    'SIMPLE_PRESENTES',
    'ABSOLUTA',
    'DOS_TERCIOS'
);


--
-- Name: medio_pago; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.medio_pago AS ENUM (
    'MERCADO_PAGO',
    'TRANSFERENCIA',
    'EFECTIVO',
    'OTRO'
);


--
-- Name: modalidad_asamblea; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.modalidad_asamblea AS ENUM (
    'PRESENCIAL',
    'HIBRIDA',
    'DIGITAL'
);


--
-- Name: naturaleza_gasto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.naturaleza_gasto AS ENUM (
    'ORDINARIO',
    'EXTRAORDINARIO',
    'FONDO_RESERVA'
);


--
-- Name: padron_votacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.padron_votacion AS ENUM (
    'SOLO_PROPIETARIOS',
    'TODAS_LAS_UNIDADES'
);


--
-- Name: periodicidad_mora; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.periodicidad_mora AS ENUM (
    'DIARIA',
    'MENSUAL'
);


--
-- Name: prioridad_reclamo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prioridad_reclamo AS ENUM (
    'BAJA',
    'MEDIA',
    'ALTA'
);


--
-- Name: resultado_votacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resultado_votacion AS ENUM (
    'APROBADA',
    'RECHAZADA',
    'SIN_QUORUM'
);


--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_usuario AS ENUM (
    'ADMINISTRADOR',
    'VECINO',
    'SUPER_ADMIN'
);


--
-- Name: tipo_adjunto; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_adjunto AS ENUM (
    'IMAGEN',
    'PDF',
    'OTRO'
);


--
-- Name: tipo_asamblea; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_asamblea AS ENUM (
    'ORDINARIA',
    'EXTRAORDINARIA'
);


--
-- Name: tipo_evento_reclamo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_evento_reclamo AS ENUM (
    'CREACION',
    'ASIGNACION',
    'CAMBIO_ESTADO',
    'RESPUESTA',
    'NOTA_INTERNA'
);


--
-- Name: tipo_notificacion; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_notificacion AS ENUM (
    'BOLETA',
    'VENCIMIENTO',
    'RECLAMO',
    'RESERVA',
    'ASAMBLEA',
    'NOVEDAD'
);


--
-- Name: tipo_punto_orden; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_punto_orden AS ENUM (
    'INFORMATIVO',
    'CON_VOTACION'
);


--
-- Name: tipo_unidad; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_unidad AS ENUM (
    'DEPARTAMENTO',
    'LOCAL',
    'COCHERA',
    'BAULERA'
);


--
-- Name: vinculo_unidad; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vinculo_unidad AS ENUM (
    'PROPIETARIO',
    'INQUILINO'
);


--
-- Name: incrementar_version_consorcio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.incrementar_version_consorcio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN NEW.version := OLD.version + 1; RETURN NEW; END $$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: amenity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amenity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid NOT NULL,
    nombre character varying(80) NOT NULL,
    icono character varying(40),
    cupo_personas smallint,
    hora_apertura time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    hora_cierre time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    anticipacion_minima_horas smallint DEFAULT 0 NOT NULL,
    duracion_maxima_horas smallint,
    requiere_aprobacion boolean DEFAULT true NOT NULL,
    monto_sena numeric(14,2) DEFAULT 0 NOT NULL,
    dias_devolucion_sena smallint DEFAULT 0 NOT NULL,
    bloquea_con_deuda boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reglamento text,
    duracion_franja_minutos integer,
    cancelacion_minima_horas integer DEFAULT 0 NOT NULL,
    lugares integer DEFAULT 1 NOT NULL,
    horario_semanal jsonb,
    CONSTRAINT ck_amenity_cancelacion CHECK ((cancelacion_minima_horas >= 0)),
    CONSTRAINT ck_amenity_franja CHECK ((duracion_franja_minutos > 0)),
    CONSTRAINT ck_amenity_horario_semanal CHECK ((jsonb_typeof(horario_semanal) = 'object'::text)),
    CONSTRAINT ck_amenity_lugares CHECK ((lugares >= 1)),
    CONSTRAINT ck_amenity_sena CHECK ((monto_sena >= (0)::numeric))
);


--
-- Name: amenity_bloqueo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amenity_bloqueo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amenity_id uuid NOT NULL,
    creado_por uuid NOT NULL,
    desde timestamp with time zone NOT NULL,
    hasta timestamp with time zone NOT NULL,
    motivo character varying(120),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_bloqueo_rango CHECK ((hasta > desde))
);


--
-- Name: asamblea; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asamblea (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid NOT NULL,
    creada_por uuid NOT NULL,
    titulo character varying(150) NOT NULL,
    tipo public.tipo_asamblea DEFAULT 'ORDINARIA'::public.tipo_asamblea NOT NULL,
    modalidad public.modalidad_asamblea DEFAULT 'PRESENCIAL'::public.modalidad_asamblea NOT NULL,
    fecha_hora timestamp with time zone NOT NULL,
    lugar character varying(120),
    link_videollamada text,
    quorum_requerido numeric(5,2) DEFAULT 60.00 NOT NULL,
    estado public.estado_asamblea DEFAULT 'BORRADOR'::public.estado_asamblea NOT NULL,
    acta_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recordatorio_enviado_at timestamp with time zone,
    CONSTRAINT ck_asamblea_lugar CHECK ((((modalidad = 'DIGITAL'::public.modalidad_asamblea) AND (link_videollamada IS NOT NULL)) OR ((modalidad = 'PRESENCIAL'::public.modalidad_asamblea) AND (lugar IS NOT NULL)) OR ((modalidad = 'HIBRIDA'::public.modalidad_asamblea) AND (lugar IS NOT NULL) AND (link_videollamada IS NOT NULL)))),
    CONSTRAINT ck_asamblea_quorum CHECK (((quorum_requerido > (0)::numeric) AND (quorum_requerido <= (100)::numeric)))
);


--
-- Name: asistencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asistencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asamblea_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    apoderado_unidad_id uuid,
    confirmada_por uuid,
    estado public.estado_asistencia DEFAULT 'SIN_RESPONDER'::public.estado_asistencia NOT NULL,
    coeficiente_aplicado numeric(7,4) NOT NULL,
    confirmada_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_asistencia_no_autopoder CHECK (((apoderado_unidad_id IS NULL) OR (apoderado_unidad_id <> unidad_id))),
    CONSTRAINT ck_asistencia_poder CHECK ((((estado = 'CON_PODER'::public.estado_asistencia) AND (apoderado_unidad_id IS NOT NULL)) OR ((estado <> 'CON_PODER'::public.estado_asistencia) AND (apoderado_unidad_id IS NULL))))
);


--
-- Name: boleta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boleta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    liquidacion_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    coeficiente_aplicado numeric(7,4) NOT NULL,
    importe_ordinarias numeric(14,2) DEFAULT 0 NOT NULL,
    importe_extraordinarias numeric(14,2) DEFAULT 0 NOT NULL,
    fondo_reserva numeric(14,2) DEFAULT 0 NOT NULL,
    saldo_anterior numeric(14,2) DEFAULT 0 NOT NULL,
    intereses_mora numeric(14,2) DEFAULT 0 NOT NULL,
    ajuste_manual numeric(14,2) DEFAULT 0 NOT NULL,
    motivo_ajuste character varying(200),
    total numeric(14,2) DEFAULT 0 NOT NULL,
    estado public.estado_boleta DEFAULT 'PENDIENTE'::public.estado_boleta NOT NULL,
    pdf_url text,
    enviada_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_boleta_ajuste CHECK (((ajuste_manual = (0)::numeric) OR (motivo_ajuste IS NOT NULL)))
);


--
-- Name: boleta_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boleta_detalle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    boleta_id uuid NOT NULL,
    gasto_id uuid,
    concepto character varying(120) NOT NULL,
    monto numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categoria_reclamo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categoria_reclamo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid,
    nombre character varying(60) NOT NULL,
    icono character varying(40),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consorcio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consorcio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    administrador_id uuid NOT NULL,
    nombre character varying(120) NOT NULL,
    calle character varying(120),
    numero character varying(10),
    barrio character varying(80),
    ciudad character varying(80),
    provincia character varying(80),
    cp character varying(10),
    cuit character varying(13),
    cbu character varying(22),
    dia_vencimiento smallint DEFAULT 10 NOT NULL,
    tasa_interes_mora numeric(5,2) DEFAULT 0 NOT NULL,
    periodicidad_mora public.periodicidad_mora DEFAULT 'MENSUAL'::public.periodicidad_mora NOT NULL,
    porcentaje_fondo_reserva numeric(5,2) DEFAULT 5.00 NOT NULL,
    quorum_default numeric(5,2) DEFAULT 60.00 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT ck_consorcio_dia_venc CHECK (((dia_vencimiento >= 1) AND (dia_vencimiento <= 28))),
    CONSTRAINT ck_consorcio_mora CHECK ((tasa_interes_mora >= (0)::numeric)),
    CONSTRAINT ck_consorcio_quorum CHECK (((quorum_default > (0)::numeric) AND (quorum_default <= (100)::numeric)))
);


--
-- Name: envio_notificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.envio_notificacion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canal public.canal_notificacion NOT NULL,
    destinatario character varying(150) NOT NULL,
    plantilla character varying(60) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    estado public.estado_envio DEFAULT 'PENDIENTE'::public.estado_envio NOT NULL,
    intentos smallint DEFAULT 0 NOT NULL,
    ultimo_error text,
    entidad_tipo character varying(40),
    entidad_id uuid,
    enviado_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evento_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_outbox (
    id uuid NOT NULL,
    routing text NOT NULL,
    contenido bytea NOT NULL,
    creado_at timestamp with time zone DEFAULT now() NOT NULL,
    publicado_at timestamp with time zone
);


--
-- Name: evento_procesado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_procesado (
    evento_id uuid NOT NULL,
    consumidor character varying(60) NOT NULL,
    procesado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gasto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    liquidacion_id uuid NOT NULL,
    rubro_id uuid NOT NULL,
    proveedor_id uuid,
    votacion_id uuid,
    reclamo_id uuid,
    descripcion character varying(200) NOT NULL,
    monto numeric(14,2) NOT NULL,
    naturaleza public.naturaleza_gasto DEFAULT 'ORDINARIO'::public.naturaleza_gasto NOT NULL,
    comprobante_url text,
    comprobante_numero character varying(50),
    cuota_numero smallint,
    cuota_total smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_gasto_cuotas CHECK ((((cuota_numero IS NULL) AND (cuota_total IS NULL)) OR ((cuota_numero IS NOT NULL) AND (cuota_total IS NOT NULL) AND ((cuota_numero >= 1) AND (cuota_numero <= cuota_total))))),
    CONSTRAINT ck_gasto_monto CHECK ((monto > (0)::numeric))
);


--
-- Name: liquidacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquidacion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid NOT NULL,
    periodo date NOT NULL,
    estado public.estado_liquidacion DEFAULT 'BORRADOR'::public.estado_liquidacion NOT NULL,
    criterio_prorrateo public.criterio_prorrateo DEFAULT 'COEFICIENTE'::public.criterio_prorrateo NOT NULL,
    fecha_vencimiento date NOT NULL,
    fecha_emision timestamp with time zone,
    total_gastos numeric(14,2) DEFAULT 0 NOT NULL,
    total_emitido numeric(14,2) DEFAULT 0 NOT NULL,
    creada_por uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_liquidacion_periodo_dia1 CHECK ((EXTRACT(day FROM periodo) = (1)::numeric))
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    titulo character varying(150) NOT NULL,
    cuerpo text,
    tipo public.tipo_notificacion NOT NULL,
    entidad_tipo character varying(40),
    entidad_id uuid,
    leida_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: novedad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.novedad (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    titulo character varying(150) NOT NULL,
    cuerpo text NOT NULL,
    fijada boolean DEFAULT false NOT NULL,
    publicada_at timestamp with time zone,
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: novedad_adjunto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.novedad_adjunto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    novedad_id uuid NOT NULL,
    url text NOT NULL,
    nombre character varying(120),
    tipo public.tipo_adjunto DEFAULT 'OTRO'::public.tipo_adjunto NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: novedad_lectura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.novedad_lectura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    novedad_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    leida_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: opcion_voto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opcion_voto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    votacion_id uuid NOT NULL,
    etiqueta character varying(60) NOT NULL,
    orden smallint DEFAULT 0 NOT NULL,
    es_fija boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pago (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    concepto public.concepto_pago NOT NULL,
    boleta_id uuid,
    reserva_id uuid,
    unidad_id uuid NOT NULL,
    registrado_por uuid,
    monto numeric(14,2) NOT NULL,
    medio public.medio_pago NOT NULL,
    estado public.estado_pago DEFAULT 'PENDIENTE'::public.estado_pago NOT NULL,
    fecha_pago timestamp with time zone,
    mp_preference_id character varying(80),
    mp_payment_id character varying(80),
    mp_status_detail character varying(60),
    recibo_numero character varying(30),
    recibo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mp_medio_pago character varying(40),
    mp_ultimos_digitos character varying(4),
    CONSTRAINT ck_pago_destino CHECK ((((concepto = 'EXPENSA'::public.concepto_pago) AND (boleta_id IS NOT NULL) AND (reserva_id IS NULL)) OR ((concepto = 'SENA_RESERVA'::public.concepto_pago) AND (reserva_id IS NOT NULL) AND (boleta_id IS NULL)))),
    CONSTRAINT ck_pago_monto CHECK ((monto > (0)::numeric)),
    CONSTRAINT ck_pago_ultimos_digitos CHECK (((mp_ultimos_digitos)::text ~ '^[0-9]{4}$'::text))
);


--
-- Name: preferencia_notificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preferencia_notificacion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    canal public.canal_notificacion NOT NULL,
    categoria public.categoria_notificacion NOT NULL,
    habilitado boolean DEFAULT true NOT NULL
);


--
-- Name: proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid,
    razon_social character varying(150) NOT NULL,
    cuit character varying(13),
    rubro character varying(60),
    email character varying(150),
    telefono character varying(30),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: punto_orden_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.punto_orden_dia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asamblea_id uuid NOT NULL,
    orden smallint NOT NULL,
    titulo character varying(150) NOT NULL,
    descripcion text,
    tipo public.tipo_punto_orden DEFAULT 'INFORMATIVO'::public.tipo_punto_orden NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recibo_pago_numero; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recibo_pago_numero
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reclamo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reclamo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo character varying(20) NOT NULL,
    consorcio_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    creado_por uuid NOT NULL,
    categoria_id uuid NOT NULL,
    proveedor_id uuid,
    descripcion text NOT NULL,
    prioridad public.prioridad_reclamo DEFAULT 'MEDIA'::public.prioridad_reclamo NOT NULL,
    estado public.estado_reclamo DEFAULT 'NUEVO'::public.estado_reclamo NOT NULL,
    cerrado_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    titulo character varying(80),
    CONSTRAINT ck_reclamo_cierre CHECK ((((estado = 'RESUELTO'::public.estado_reclamo) AND (cerrado_at IS NOT NULL)) OR ((estado <> 'RESUELTO'::public.estado_reclamo) AND (cerrado_at IS NULL)))),
    CONSTRAINT ck_reclamo_titulo CHECK ((length(TRIM(BOTH FROM titulo)) > 0))
);


--
-- Name: reclamo_adjunto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reclamo_adjunto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reclamo_id uuid NOT NULL,
    url text NOT NULL,
    nombre character varying(120),
    orden smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_adjunto_orden CHECK (((orden >= 0) AND (orden <= 4)))
);


--
-- Name: reclamo_evento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reclamo_evento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reclamo_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    tipo public.tipo_evento_reclamo NOT NULL,
    mensaje text,
    estado_anterior public.estado_reclamo,
    estado_nuevo public.estado_reclamo,
    visible_para_vecino boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    proveedor_id uuid
);


--
-- Name: reserva; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserva (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amenity_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    solicitada_por uuid NOT NULL,
    resuelta_por uuid,
    inicio timestamp with time zone NOT NULL,
    fin timestamp with time zone NOT NULL,
    estado public.estado_reserva DEFAULT 'PENDIENTE'::public.estado_reserva NOT NULL,
    motivo character varying(120),
    motivo_rechazo character varying(200),
    resuelta_at timestamp with time zone,
    sena_devuelta_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lugar integer DEFAULT 1 NOT NULL,
    CONSTRAINT ck_reserva_lugar CHECK ((lugar >= 1)),
    CONSTRAINT ck_reserva_rango CHECK ((fin > inicio))
);


--
-- Name: rubro_gasto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubro_gasto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid,
    nombre character varying(80) NOT NULL,
    icono character varying(40),
    naturaleza public.naturaleza_gasto DEFAULT 'ORDINARIO'::public.naturaleza_gasto NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitud_idempotente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitud_idempotente (
    usuario_id uuid NOT NULL,
    metodo text NOT NULL,
    ruta text NOT NULL,
    clave character varying(128) NOT NULL,
    huella text NOT NULL,
    estado_http integer NOT NULL,
    respuesta jsonb NOT NULL,
    cabeceras jsonb DEFAULT '{}'::jsonb NOT NULL,
    creado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: unidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidad (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid NOT NULL,
    etiqueta character varying(20) NOT NULL,
    piso character varying(5),
    departamento character varying(5),
    tipo public.tipo_unidad DEFAULT 'DEPARTAMENTO'::public.tipo_unidad NOT NULL,
    coeficiente numeric(7,4) NOT NULL,
    metros_cuadrados numeric(8,2),
    activa boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_unidad_coeficiente CHECK (((coeficiente > (0)::numeric) AND (coeficiente <= (100)::numeric)))
);


--
-- Name: unidad_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidad_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unidad_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    vinculo public.vinculo_unidad NOT NULL,
    es_titular boolean DEFAULT false NOT NULL,
    desde date DEFAULT CURRENT_DATE NOT NULL,
    hasta date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_unidad_usuario_vigencia CHECK (((hasta IS NULL) OR (hasta > desde)))
);


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(80) NOT NULL,
    apellido character varying(80) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    dni character varying(20),
    telefono character varying(30),
    rol public.rol_usuario DEFAULT 'VECINO'::public.rol_usuario NOT NULL,
    avatar_url text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: votacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.votacion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consorcio_id uuid NOT NULL,
    asamblea_id uuid,
    punto_orden_dia_id uuid,
    titulo character varying(150) NOT NULL,
    descripcion text,
    adjunto_url text,
    padron public.padron_votacion DEFAULT 'SOLO_PROPIETARIOS'::public.padron_votacion NOT NULL,
    forma_conteo public.forma_conteo DEFAULT 'POR_COEFICIENTE'::public.forma_conteo NOT NULL,
    mayoria public.mayoria_requerida DEFAULT 'SIMPLE_PRESENTES'::public.mayoria_requerida NOT NULL,
    desempate public.criterio_desempate DEFAULT 'RECHAZADA'::public.criterio_desempate NOT NULL,
    permite_voto_anticipado boolean DEFAULT false NOT NULL,
    mostrar_parcial boolean DEFAULT false NOT NULL,
    bloquea_con_deuda boolean DEFAULT false NOT NULL,
    apertura timestamp with time zone NOT NULL,
    cierre timestamp with time zone NOT NULL,
    estado public.estado_votacion DEFAULT 'BORRADOR'::public.estado_votacion NOT NULL,
    resultado public.resultado_votacion,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_votacion_rango CHECK ((cierre > apertura)),
    CONSTRAINT ck_votacion_resultado CHECK (((estado = 'CERRADA'::public.estado_votacion) OR ((estado <> 'CERRADA'::public.estado_votacion) AND (resultado IS NULL))))
);


--
-- Name: voto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    votacion_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    opcion_id uuid NOT NULL,
    emitido_por uuid NOT NULL,
    coeficiente_aplicado numeric(7,4) NOT NULL,
    anticipado boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: amenity_bloqueo amenity_bloqueo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenity_bloqueo
    ADD CONSTRAINT amenity_bloqueo_pkey PRIMARY KEY (id);


--
-- Name: amenity amenity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenity
    ADD CONSTRAINT amenity_pkey PRIMARY KEY (id);


--
-- Name: asamblea asamblea_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asamblea
    ADD CONSTRAINT asamblea_pkey PRIMARY KEY (id);


--
-- Name: asistencia asistencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_pkey PRIMARY KEY (id);


--
-- Name: boleta_detalle boleta_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta_detalle
    ADD CONSTRAINT boleta_detalle_pkey PRIMARY KEY (id);


--
-- Name: boleta boleta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta
    ADD CONSTRAINT boleta_pkey PRIMARY KEY (id);


--
-- Name: categoria_reclamo categoria_reclamo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria_reclamo
    ADD CONSTRAINT categoria_reclamo_pkey PRIMARY KEY (id);


--
-- Name: consorcio consorcio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consorcio
    ADD CONSTRAINT consorcio_pkey PRIMARY KEY (id);


--
-- Name: envio_notificacion envio_notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envio_notificacion
    ADD CONSTRAINT envio_notificacion_pkey PRIMARY KEY (id);


--
-- Name: evento_outbox evento_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_outbox
    ADD CONSTRAINT evento_outbox_pkey PRIMARY KEY (id);


--
-- Name: reserva ex_reserva_solapada; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT ex_reserva_solapada EXCLUDE USING gist (amenity_id WITH =, lugar WITH =, tstzrange(inicio, fin) WITH &&) WHERE ((estado = ANY (ARRAY['PENDIENTE'::public.estado_reserva, 'APROBADA'::public.estado_reserva])));


--
-- Name: gasto gasto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT gasto_pkey PRIMARY KEY (id);


--
-- Name: liquidacion liquidacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidacion
    ADD CONSTRAINT liquidacion_pkey PRIMARY KEY (id);


--
-- Name: notificacion notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_pkey PRIMARY KEY (id);


--
-- Name: novedad_adjunto novedad_adjunto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad_adjunto
    ADD CONSTRAINT novedad_adjunto_pkey PRIMARY KEY (id);


--
-- Name: novedad_lectura novedad_lectura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad_lectura
    ADD CONSTRAINT novedad_lectura_pkey PRIMARY KEY (id);


--
-- Name: novedad novedad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad
    ADD CONSTRAINT novedad_pkey PRIMARY KEY (id);


--
-- Name: opcion_voto opcion_voto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opcion_voto
    ADD CONSTRAINT opcion_voto_pkey PRIMARY KEY (id);


--
-- Name: pago pago_mp_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_mp_payment_id_key UNIQUE (mp_payment_id);


--
-- Name: pago pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_pkey PRIMARY KEY (id);


--
-- Name: evento_procesado pk_evento_procesado; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_procesado
    ADD CONSTRAINT pk_evento_procesado PRIMARY KEY (evento_id, consumidor);


--
-- Name: preferencia_notificacion preferencia_notificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencia_notificacion
    ADD CONSTRAINT preferencia_notificacion_pkey PRIMARY KEY (id);


--
-- Name: proveedor proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT proveedor_pkey PRIMARY KEY (id);


--
-- Name: punto_orden_dia punto_orden_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.punto_orden_dia
    ADD CONSTRAINT punto_orden_dia_pkey PRIMARY KEY (id);


--
-- Name: reclamo_adjunto reclamo_adjunto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo_adjunto
    ADD CONSTRAINT reclamo_adjunto_pkey PRIMARY KEY (id);


--
-- Name: reclamo reclamo_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo
    ADD CONSTRAINT reclamo_codigo_key UNIQUE (codigo);


--
-- Name: reclamo_evento reclamo_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo_evento
    ADD CONSTRAINT reclamo_evento_pkey PRIMARY KEY (id);


--
-- Name: reclamo reclamo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo
    ADD CONSTRAINT reclamo_pkey PRIMARY KEY (id);


--
-- Name: reserva reserva_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_pkey PRIMARY KEY (id);


--
-- Name: rubro_gasto rubro_gasto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubro_gasto
    ADD CONSTRAINT rubro_gasto_pkey PRIMARY KEY (id);


--
-- Name: solicitud_idempotente solicitud_idempotente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_idempotente
    ADD CONSTRAINT solicitud_idempotente_pkey PRIMARY KEY (usuario_id, metodo, ruta, clave);


--
-- Name: unidad unidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidad
    ADD CONSTRAINT unidad_pkey PRIMARY KEY (id);


--
-- Name: unidad_usuario unidad_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidad_usuario
    ADD CONSTRAINT unidad_usuario_pkey PRIMARY KEY (id);


--
-- Name: asistencia uq_asistencia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT uq_asistencia UNIQUE (asamblea_id, unidad_id);


--
-- Name: boleta uq_boleta_unidad; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta
    ADD CONSTRAINT uq_boleta_unidad UNIQUE (liquidacion_id, unidad_id);


--
-- Name: liquidacion uq_liquidacion_periodo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidacion
    ADD CONSTRAINT uq_liquidacion_periodo UNIQUE (consorcio_id, periodo);


--
-- Name: novedad_lectura uq_novedad_lectura; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad_lectura
    ADD CONSTRAINT uq_novedad_lectura UNIQUE (novedad_id, usuario_id);


--
-- Name: preferencia_notificacion uq_preferencia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencia_notificacion
    ADD CONSTRAINT uq_preferencia UNIQUE (usuario_id, canal, categoria);


--
-- Name: punto_orden_dia uq_punto_orden; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.punto_orden_dia
    ADD CONSTRAINT uq_punto_orden UNIQUE (asamblea_id, orden) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: unidad uq_unidad_etiqueta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidad
    ADD CONSTRAINT uq_unidad_etiqueta UNIQUE (consorcio_id, etiqueta);


--
-- Name: voto uq_voto_unidad; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT uq_voto_unidad UNIQUE (votacion_id, unidad_id);


--
-- Name: usuario usuario_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_email_key UNIQUE (email);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- Name: votacion votacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votacion
    ADD CONSTRAINT votacion_pkey PRIMARY KEY (id);


--
-- Name: votacion votacion_punto_orden_dia_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votacion
    ADD CONSTRAINT votacion_punto_orden_dia_id_key UNIQUE (punto_orden_dia_id);


--
-- Name: voto voto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT voto_pkey PRIMARY KEY (id);


--
-- Name: evento_outbox_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evento_outbox_pendientes ON public.evento_outbox USING btree (creado_at) WHERE (publicado_at IS NULL);


--
-- Name: ix_asistencia_asamblea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asistencia_asamblea ON public.asistencia USING btree (asamblea_id, estado);


--
-- Name: ix_boleta_liquidacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boleta_liquidacion ON public.boleta USING btree (liquidacion_id);


--
-- Name: ix_boleta_unidad_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_boleta_unidad_estado ON public.boleta USING btree (unidad_id, estado);


--
-- Name: ix_envio_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_envio_pendientes ON public.envio_notificacion USING btree (estado, intentos) WHERE (estado <> 'ENVIADO'::public.estado_envio);


--
-- Name: ix_gasto_liquidacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gasto_liquidacion ON public.gasto USING btree (liquidacion_id);


--
-- Name: ix_liquidacion_consorcio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_liquidacion_consorcio ON public.liquidacion USING btree (consorcio_id, periodo DESC);


--
-- Name: ix_notificacion_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notificacion_usuario ON public.notificacion USING btree (usuario_id, leida_at NULLS FIRST);


--
-- Name: ix_novedad_consorcio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_novedad_consorcio ON public.novedad USING btree (consorcio_id, publicada_at DESC);


--
-- Name: ix_pago_boleta_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pago_boleta_estado ON public.pago USING btree (boleta_id, estado);


--
-- Name: ix_pago_reserva; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pago_reserva ON public.pago USING btree (reserva_id) WHERE (reserva_id IS NOT NULL);


--
-- Name: ix_reclamo_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reclamo_evento ON public.reclamo_evento USING btree (reclamo_id, created_at);


--
-- Name: ix_reclamo_tablero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reclamo_tablero ON public.reclamo USING btree (consorcio_id, estado, prioridad);


--
-- Name: ix_reclamo_unidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reclamo_unidad ON public.reclamo USING btree (unidad_id);


--
-- Name: ix_reserva_calendario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reserva_calendario ON public.reserva USING btree (amenity_id, inicio, fin);


--
-- Name: ix_reserva_unidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reserva_unidad ON public.reserva USING btree (unidad_id);


--
-- Name: ix_unidad_consorcio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_unidad_consorcio ON public.unidad USING btree (consorcio_id) WHERE activa;


--
-- Name: ix_unidad_usuario_unidad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_unidad_usuario_unidad ON public.unidad_usuario USING btree (unidad_id) WHERE (hasta IS NULL);


--
-- Name: ix_unidad_usuario_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_unidad_usuario_usuario ON public.unidad_usuario USING btree (usuario_id) WHERE (hasta IS NULL);


--
-- Name: ix_votacion_abiertas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_votacion_abiertas ON public.votacion USING btree (consorcio_id, estado, cierre);


--
-- Name: ix_voto_votacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_voto_votacion ON public.voto USING btree (votacion_id, opcion_id);


--
-- Name: amenity tg_amenity_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_amenity_updated BEFORE UPDATE ON public.amenity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: asamblea tg_asamblea_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_asamblea_updated BEFORE UPDATE ON public.asamblea FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: asistencia tg_asistencia_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_asistencia_updated BEFORE UPDATE ON public.asistencia FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: boleta tg_boleta_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_boleta_updated BEFORE UPDATE ON public.boleta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: consorcio tg_consorcio_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_consorcio_updated BEFORE UPDATE ON public.consorcio FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: envio_notificacion tg_envio_notificacion_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_envio_notificacion_updated BEFORE UPDATE ON public.envio_notificacion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: gasto tg_gasto_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_gasto_updated BEFORE UPDATE ON public.gasto FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: liquidacion tg_liquidacion_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_liquidacion_updated BEFORE UPDATE ON public.liquidacion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: novedad tg_novedad_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_novedad_updated BEFORE UPDATE ON public.novedad FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pago tg_pago_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_pago_updated BEFORE UPDATE ON public.pago FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: proveedor tg_proveedor_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_proveedor_updated BEFORE UPDATE ON public.proveedor FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reclamo tg_reclamo_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_reclamo_updated BEFORE UPDATE ON public.reclamo FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reserva tg_reserva_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_reserva_updated BEFORE UPDATE ON public.reserva FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rubro_gasto tg_rubro_gasto_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_rubro_gasto_updated BEFORE UPDATE ON public.rubro_gasto FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: unidad tg_unidad_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_unidad_updated BEFORE UPDATE ON public.unidad FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: unidad_usuario tg_unidad_usuario_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_unidad_usuario_updated BEFORE UPDATE ON public.unidad_usuario FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: usuario tg_usuario_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_usuario_updated BEFORE UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: votacion tg_votacion_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_votacion_updated BEFORE UPDATE ON public.votacion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: consorcio version_consorcio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER version_consorcio BEFORE UPDATE ON public.consorcio FOR EACH ROW EXECUTE FUNCTION public.incrementar_version_consorcio();


--
-- Name: amenity_bloqueo amenity_bloqueo_amenity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenity_bloqueo
    ADD CONSTRAINT amenity_bloqueo_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenity(id) ON DELETE CASCADE;


--
-- Name: amenity_bloqueo amenity_bloqueo_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenity_bloqueo
    ADD CONSTRAINT amenity_bloqueo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: amenity amenity_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amenity
    ADD CONSTRAINT amenity_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE CASCADE;


--
-- Name: asamblea asamblea_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asamblea
    ADD CONSTRAINT asamblea_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE RESTRICT;


--
-- Name: asamblea asamblea_creada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asamblea
    ADD CONSTRAINT asamblea_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: asistencia asistencia_apoderado_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_apoderado_unidad_id_fkey FOREIGN KEY (apoderado_unidad_id) REFERENCES public.unidad(id) ON DELETE RESTRICT;


--
-- Name: asistencia asistencia_asamblea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES public.asamblea(id) ON DELETE CASCADE;


--
-- Name: asistencia asistencia_confirmada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_confirmada_por_fkey FOREIGN KEY (confirmada_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: asistencia asistencia_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asistencia
    ADD CONSTRAINT asistencia_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad(id) ON DELETE RESTRICT;


--
-- Name: boleta_detalle boleta_detalle_boleta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta_detalle
    ADD CONSTRAINT boleta_detalle_boleta_id_fkey FOREIGN KEY (boleta_id) REFERENCES public.boleta(id) ON DELETE CASCADE;


--
-- Name: boleta_detalle boleta_detalle_gasto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta_detalle
    ADD CONSTRAINT boleta_detalle_gasto_id_fkey FOREIGN KEY (gasto_id) REFERENCES public.gasto(id) ON DELETE SET NULL;


--
-- Name: boleta boleta_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta
    ADD CONSTRAINT boleta_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES public.liquidacion(id) ON DELETE CASCADE;


--
-- Name: boleta boleta_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta
    ADD CONSTRAINT boleta_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad(id) ON DELETE RESTRICT;


--
-- Name: categoria_reclamo categoria_reclamo_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria_reclamo
    ADD CONSTRAINT categoria_reclamo_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE CASCADE;


--
-- Name: consorcio consorcio_administrador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consorcio
    ADD CONSTRAINT consorcio_administrador_id_fkey FOREIGN KEY (administrador_id) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: gasto fk_gasto_reclamo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT fk_gasto_reclamo FOREIGN KEY (reclamo_id) REFERENCES public.reclamo(id) ON DELETE SET NULL;


--
-- Name: gasto fk_gasto_votacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT fk_gasto_votacion FOREIGN KEY (votacion_id) REFERENCES public.votacion(id) ON DELETE SET NULL;


--
-- Name: reclamo_evento fk_reclamo_evento_proveedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo_evento
    ADD CONSTRAINT fk_reclamo_evento_proveedor FOREIGN KEY (proveedor_id) REFERENCES public.proveedor(id) ON DELETE SET NULL;


--
-- Name: gasto gasto_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT gasto_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES public.liquidacion(id) ON DELETE CASCADE;


--
-- Name: gasto gasto_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT gasto_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedor(id) ON DELETE RESTRICT;


--
-- Name: gasto gasto_rubro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT gasto_rubro_id_fkey FOREIGN KEY (rubro_id) REFERENCES public.rubro_gasto(id) ON DELETE RESTRICT;


--
-- Name: liquidacion liquidacion_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidacion
    ADD CONSTRAINT liquidacion_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE RESTRICT;


--
-- Name: liquidacion liquidacion_creada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidacion
    ADD CONSTRAINT liquidacion_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: notificacion notificacion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacion
    ADD CONSTRAINT notificacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: novedad_adjunto novedad_adjunto_novedad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad_adjunto
    ADD CONSTRAINT novedad_adjunto_novedad_id_fkey FOREIGN KEY (novedad_id) REFERENCES public.novedad(id) ON DELETE CASCADE;


--
-- Name: novedad novedad_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad
    ADD CONSTRAINT novedad_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: novedad novedad_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad
    ADD CONSTRAINT novedad_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE CASCADE;


--
-- Name: novedad_lectura novedad_lectura_novedad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad_lectura
    ADD CONSTRAINT novedad_lectura_novedad_id_fkey FOREIGN KEY (novedad_id) REFERENCES public.novedad(id) ON DELETE CASCADE;


--
-- Name: novedad_lectura novedad_lectura_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedad_lectura
    ADD CONSTRAINT novedad_lectura_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: opcion_voto opcion_voto_votacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opcion_voto
    ADD CONSTRAINT opcion_voto_votacion_id_fkey FOREIGN KEY (votacion_id) REFERENCES public.votacion(id) ON DELETE CASCADE;


--
-- Name: pago pago_boleta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_boleta_id_fkey FOREIGN KEY (boleta_id) REFERENCES public.boleta(id) ON DELETE RESTRICT;


--
-- Name: pago pago_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: pago pago_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.reserva(id) ON DELETE RESTRICT;


--
-- Name: pago pago_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pago
    ADD CONSTRAINT pago_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad(id) ON DELETE RESTRICT;


--
-- Name: preferencia_notificacion preferencia_notificacion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferencia_notificacion
    ADD CONSTRAINT preferencia_notificacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;


--
-- Name: proveedor proveedor_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT proveedor_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE CASCADE;


--
-- Name: punto_orden_dia punto_orden_dia_asamblea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.punto_orden_dia
    ADD CONSTRAINT punto_orden_dia_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES public.asamblea(id) ON DELETE CASCADE;


--
-- Name: reclamo_adjunto reclamo_adjunto_reclamo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo_adjunto
    ADD CONSTRAINT reclamo_adjunto_reclamo_id_fkey FOREIGN KEY (reclamo_id) REFERENCES public.reclamo(id) ON DELETE CASCADE;


--
-- Name: reclamo reclamo_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo
    ADD CONSTRAINT reclamo_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categoria_reclamo(id) ON DELETE RESTRICT;


--
-- Name: reclamo reclamo_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo
    ADD CONSTRAINT reclamo_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE RESTRICT;


--
-- Name: reclamo reclamo_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo
    ADD CONSTRAINT reclamo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: reclamo_evento reclamo_evento_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo_evento
    ADD CONSTRAINT reclamo_evento_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: reclamo_evento reclamo_evento_reclamo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo_evento
    ADD CONSTRAINT reclamo_evento_reclamo_id_fkey FOREIGN KEY (reclamo_id) REFERENCES public.reclamo(id) ON DELETE CASCADE;


--
-- Name: reclamo reclamo_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo
    ADD CONSTRAINT reclamo_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedor(id) ON DELETE SET NULL;


--
-- Name: reclamo reclamo_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reclamo
    ADD CONSTRAINT reclamo_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad(id) ON DELETE RESTRICT;


--
-- Name: reserva reserva_amenity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_amenity_id_fkey FOREIGN KEY (amenity_id) REFERENCES public.amenity(id) ON DELETE RESTRICT;


--
-- Name: reserva reserva_resuelta_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_resuelta_por_fkey FOREIGN KEY (resuelta_por) REFERENCES public.usuario(id) ON DELETE SET NULL;


--
-- Name: reserva reserva_solicitada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_solicitada_por_fkey FOREIGN KEY (solicitada_por) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: reserva reserva_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva
    ADD CONSTRAINT reserva_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad(id) ON DELETE RESTRICT;


--
-- Name: rubro_gasto rubro_gasto_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubro_gasto
    ADD CONSTRAINT rubro_gasto_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE CASCADE;


--
-- Name: solicitud_idempotente solicitud_idempotente_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_idempotente
    ADD CONSTRAINT solicitud_idempotente_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


--
-- Name: unidad unidad_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidad
    ADD CONSTRAINT unidad_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE RESTRICT;


--
-- Name: unidad_usuario unidad_usuario_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidad_usuario
    ADD CONSTRAINT unidad_usuario_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad(id) ON DELETE CASCADE;


--
-- Name: unidad_usuario unidad_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidad_usuario
    ADD CONSTRAINT unidad_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: votacion votacion_asamblea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votacion
    ADD CONSTRAINT votacion_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES public.asamblea(id) ON DELETE CASCADE;


--
-- Name: votacion votacion_consorcio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votacion
    ADD CONSTRAINT votacion_consorcio_id_fkey FOREIGN KEY (consorcio_id) REFERENCES public.consorcio(id) ON DELETE RESTRICT;


--
-- Name: votacion votacion_punto_orden_dia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votacion
    ADD CONSTRAINT votacion_punto_orden_dia_id_fkey FOREIGN KEY (punto_orden_dia_id) REFERENCES public.punto_orden_dia(id) ON DELETE SET NULL;


--
-- Name: voto voto_emitido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT voto_emitido_por_fkey FOREIGN KEY (emitido_por) REFERENCES public.usuario(id) ON DELETE RESTRICT;


--
-- Name: voto voto_opcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT voto_opcion_id_fkey FOREIGN KEY (opcion_id) REFERENCES public.opcion_voto(id) ON DELETE RESTRICT;


--
-- Name: voto voto_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT voto_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidad(id) ON DELETE RESTRICT;


--
-- Name: voto voto_votacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voto
    ADD CONSTRAINT voto_votacion_id_fkey FOREIGN KEY (votacion_id) REFERENCES public.votacion(id) ON DELETE CASCADE;


--
-- Name: amenity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.amenity ENABLE ROW LEVEL SECURITY;

--
-- Name: amenity_bloqueo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.amenity_bloqueo ENABLE ROW LEVEL SECURITY;

--
-- Name: asamblea; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asamblea ENABLE ROW LEVEL SECURITY;

--
-- Name: asistencia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asistencia ENABLE ROW LEVEL SECURITY;

--
-- Name: boleta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boleta ENABLE ROW LEVEL SECURITY;

--
-- Name: boleta_detalle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boleta_detalle ENABLE ROW LEVEL SECURITY;

--
-- Name: categoria_reclamo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categoria_reclamo ENABLE ROW LEVEL SECURITY;

--
-- Name: consorcio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consorcio ENABLE ROW LEVEL SECURITY;

--
-- Name: envio_notificacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.envio_notificacion ENABLE ROW LEVEL SECURITY;

--
-- Name: evento_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evento_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: evento_procesado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evento_procesado ENABLE ROW LEVEL SECURITY;

--
-- Name: gasto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gasto ENABLE ROW LEVEL SECURITY;

--
-- Name: liquidacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.liquidacion ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificacion ENABLE ROW LEVEL SECURITY;

--
-- Name: novedad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.novedad ENABLE ROW LEVEL SECURITY;

--
-- Name: novedad_adjunto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.novedad_adjunto ENABLE ROW LEVEL SECURITY;

--
-- Name: novedad_lectura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.novedad_lectura ENABLE ROW LEVEL SECURITY;

--
-- Name: opcion_voto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opcion_voto ENABLE ROW LEVEL SECURITY;

--
-- Name: pago; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pago ENABLE ROW LEVEL SECURITY;

--
-- Name: preferencia_notificacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preferencia_notificacion ENABLE ROW LEVEL SECURITY;

--
-- Name: proveedor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proveedor ENABLE ROW LEVEL SECURITY;

--
-- Name: punto_orden_dia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.punto_orden_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: reclamo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reclamo ENABLE ROW LEVEL SECURITY;

--
-- Name: reclamo_adjunto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reclamo_adjunto ENABLE ROW LEVEL SECURITY;

--
-- Name: reclamo_evento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reclamo_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: reserva; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reserva ENABLE ROW LEVEL SECURITY;

--
-- Name: rubro_gasto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rubro_gasto ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitud_idempotente; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitud_idempotente ENABLE ROW LEVEL SECURITY;

--
-- Name: unidad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unidad ENABLE ROW LEVEL SECURITY;

--
-- Name: unidad_usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unidad_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: usuario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: votacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.votacion ENABLE ROW LEVEL SECURITY;

--
-- Name: voto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voto ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
