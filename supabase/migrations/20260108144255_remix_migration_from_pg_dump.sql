CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

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



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'skeppare',
    'readonly'
);


--
-- Name: crew_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.crew_role AS ENUM (
    'befalhavare',
    'matros',
    'jungman',
    'restaurangpersonal'
);


--
-- Name: logbook_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.logbook_status AS ENUM (
    'oppen',
    'stangd'
);


--
-- Name: audit_logbook_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_logbook_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_audit('logbooks', NEW.id, 'INSERT', NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.log_audit('logbooks', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.log_audit('logbooks', OLD.id, 'DELETE', to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
    RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_admin_or_skeppare(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_or_skeppare(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'skeppare')
  )
$$;


--
-- Name: log_audit(text, uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit(p_table_name text, p_record_id uuid, p_action text, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, old_data, new_data)
    VALUES (p_table_name, p_record_id, p_action, auth.uid(), p_old_data, p_new_data);
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    user_id uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: certificate_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: logbook_crew; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logbook_crew (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logbook_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.crew_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: logbook_engine_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logbook_engine_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logbook_id uuid NOT NULL,
    notes text,
    operational_status text DEFAULT 'drift'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    start_hours integer,
    stop_hours integer
);


--
-- Name: logbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logbooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vessel_id uuid NOT NULL,
    date date NOT NULL,
    status public.logbook_status DEFAULT 'oppen'::public.logbook_status NOT NULL,
    weather text,
    wind text,
    general_notes text,
    from_location text,
    to_location text,
    passenger_count integer,
    departure_time time without time zone,
    arrival_time time without time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    closed_by uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_certificate_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_certificate_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.crew_role NOT NULL,
    certificate_type_id uuid NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    group_logic text DEFAULT 'AND'::text,
    group_name text,
    requires_induction boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    certificate_type_id uuid NOT NULL,
    issue_date date,
    expiry_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_vessel_inductions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_vessel_inductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    vessel_id uuid NOT NULL,
    inducted_at date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vessel_crew_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_crew_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vessel_id uuid NOT NULL,
    role public.crew_role NOT NULL,
    minimum_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vessels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: certificate_types certificate_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_types
    ADD CONSTRAINT certificate_types_name_key UNIQUE (name);


--
-- Name: certificate_types certificate_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_types
    ADD CONSTRAINT certificate_types_pkey PRIMARY KEY (id);


--
-- Name: logbook_crew logbook_crew_logbook_id_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbook_crew
    ADD CONSTRAINT logbook_crew_logbook_id_user_id_role_key UNIQUE (logbook_id, user_id, role);


--
-- Name: logbook_crew logbook_crew_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbook_crew
    ADD CONSTRAINT logbook_crew_pkey PRIMARY KEY (id);


--
-- Name: logbook_engine_hours logbook_engine_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbook_engine_hours
    ADD CONSTRAINT logbook_engine_hours_pkey PRIMARY KEY (id);


--
-- Name: logbooks logbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbooks
    ADD CONSTRAINT logbooks_pkey PRIMARY KEY (id);


--
-- Name: logbooks logbooks_vessel_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbooks
    ADD CONSTRAINT logbooks_vessel_id_date_key UNIQUE (vessel_id, date);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: role_certificate_rules role_certificate_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_certificate_rules
    ADD CONSTRAINT role_certificate_rules_pkey PRIMARY KEY (id);


--
-- Name: user_certificates user_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_certificates
    ADD CONSTRAINT user_certificates_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);


--
-- Name: user_vessel_inductions user_vessel_inductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_vessel_inductions
    ADD CONSTRAINT user_vessel_inductions_pkey PRIMARY KEY (id);


--
-- Name: user_vessel_inductions user_vessel_inductions_user_id_vessel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_vessel_inductions
    ADD CONSTRAINT user_vessel_inductions_user_id_vessel_id_key UNIQUE (user_id, vessel_id);


--
-- Name: vessel_crew_requirements vessel_crew_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_crew_requirements
    ADD CONSTRAINT vessel_crew_requirements_pkey PRIMARY KEY (id);


--
-- Name: vessel_crew_requirements vessel_crew_requirements_vessel_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_crew_requirements
    ADD CONSTRAINT vessel_crew_requirements_vessel_id_role_key UNIQUE (vessel_id, role);


--
-- Name: vessels vessels_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessels
    ADD CONSTRAINT vessels_name_key UNIQUE (name);


--
-- Name: vessels vessels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessels
    ADD CONSTRAINT vessels_pkey PRIMARY KEY (id);


--
-- Name: logbooks audit_logbooks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_logbooks AFTER INSERT OR DELETE OR UPDATE ON public.logbooks FOR EACH ROW EXECUTE FUNCTION public.audit_logbook_changes();


--
-- Name: logbooks update_logbooks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_logbooks_updated_at BEFORE UPDATE ON public.logbooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_certificates update_user_certificates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_certificates_updated_at BEFORE UPDATE ON public.user_certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vessels update_vessels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vessels_updated_at BEFORE UPDATE ON public.vessels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: logbook_crew logbook_crew_logbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbook_crew
    ADD CONSTRAINT logbook_crew_logbook_id_fkey FOREIGN KEY (logbook_id) REFERENCES public.logbooks(id) ON DELETE CASCADE;


--
-- Name: logbook_crew logbook_crew_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbook_crew
    ADD CONSTRAINT logbook_crew_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: logbook_engine_hours logbook_engine_hours_logbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbook_engine_hours
    ADD CONSTRAINT logbook_engine_hours_logbook_id_fkey FOREIGN KEY (logbook_id) REFERENCES public.logbooks(id) ON DELETE CASCADE;


--
-- Name: logbooks logbooks_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbooks
    ADD CONSTRAINT logbooks_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id);


--
-- Name: logbooks logbooks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbooks
    ADD CONSTRAINT logbooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: logbooks logbooks_vessel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logbooks
    ADD CONSTRAINT logbooks_vessel_id_fkey FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_certificate_rules role_certificate_rules_certificate_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_certificate_rules
    ADD CONSTRAINT role_certificate_rules_certificate_type_id_fkey FOREIGN KEY (certificate_type_id) REFERENCES public.certificate_types(id) ON DELETE CASCADE;


--
-- Name: user_certificates user_certificates_certificate_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_certificates
    ADD CONSTRAINT user_certificates_certificate_type_id_fkey FOREIGN KEY (certificate_type_id) REFERENCES public.certificate_types(id) ON DELETE CASCADE;


--
-- Name: user_certificates user_certificates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_certificates
    ADD CONSTRAINT user_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_vessel_inductions user_vessel_inductions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_vessel_inductions
    ADD CONSTRAINT user_vessel_inductions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_vessel_inductions user_vessel_inductions_vessel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_vessel_inductions
    ADD CONSTRAINT user_vessel_inductions_vessel_id_fkey FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE CASCADE;


--
-- Name: vessel_crew_requirements vessel_crew_requirements_vessel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_crew_requirements
    ADD CONSTRAINT vessel_crew_requirements_vessel_id_fkey FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE CASCADE;


--
-- Name: vessel_crew_requirements Admin kan hantera bemanningskrav; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan hantera bemanningskrav" ON public.vessel_crew_requirements TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_certificates Admin kan hantera certifikat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan hantera certifikat" ON public.user_certificates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: certificate_types Admin kan hantera certifikattyper; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan hantera certifikattyper" ON public.certificate_types TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: vessels Admin kan hantera fartyg; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan hantera fartyg" ON public.vessels TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_vessel_inductions Admin kan hantera inskolningar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan hantera inskolningar" ON public.user_vessel_inductions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admin kan hantera roller; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan hantera roller" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: role_certificate_rules Admin kan hantera rollregler; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan hantera rollregler" ON public.role_certificate_rules TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Admin kan se ändringsloggar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan se ändringsloggar" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: logbooks Admin kan ta bort loggböcker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin kan ta bort loggböcker" ON public.logbooks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: vessel_crew_requirements Alla kan se bemanningskrav; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se bemanningskrav" ON public.vessel_crew_requirements FOR SELECT TO authenticated USING (true);


--
-- Name: logbook_crew Alla kan se besättning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se besättning" ON public.logbook_crew FOR SELECT TO authenticated USING (true);


--
-- Name: certificate_types Alla kan se certifikattyper; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se certifikattyper" ON public.certificate_types FOR SELECT TO authenticated USING (true);


--
-- Name: vessels Alla kan se fartyg; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se fartyg" ON public.vessels FOR SELECT TO authenticated USING (true);


--
-- Name: user_vessel_inductions Alla kan se inskolningar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se inskolningar" ON public.user_vessel_inductions FOR SELECT TO authenticated USING (true);


--
-- Name: logbooks Alla kan se loggböcker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se loggböcker" ON public.logbooks FOR SELECT TO authenticated USING (true);


--
-- Name: logbook_engine_hours Alla kan se maskintimmar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se maskintimmar" ON public.logbook_engine_hours FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Alla kan se profiler; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se profiler" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: role_certificate_rules Alla kan se rollregler; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se rollregler" ON public.role_certificate_rules FOR SELECT TO authenticated USING (true);


--
-- Name: user_roles Alla kan se sina roller; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alla kan se sina roller" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_certificates Användare kan se sina certifikat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Användare kan se sina certifikat" ON public.user_certificates FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Användare kan skapa sin profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Användare kan skapa sin profil" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Användare kan uppdatera sin profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Användare kan uppdatera sin profil" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: logbook_crew Skeppare kan hantera besättning; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Skeppare kan hantera besättning" ON public.logbook_crew TO authenticated USING (public.is_admin_or_skeppare(auth.uid()));


--
-- Name: logbook_engine_hours Skeppare kan hantera maskintimmar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Skeppare kan hantera maskintimmar" ON public.logbook_engine_hours TO authenticated USING (public.is_admin_or_skeppare(auth.uid()));


--
-- Name: logbooks Skeppare kan skapa loggböcker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Skeppare kan skapa loggböcker" ON public.logbooks FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_skeppare(auth.uid()));


--
-- Name: logbooks Skeppare kan uppdatera öppna loggböcker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Skeppare kan uppdatera öppna loggböcker" ON public.logbooks FOR UPDATE TO authenticated USING ((public.is_admin_or_skeppare(auth.uid()) AND ((status = 'oppen'::public.logbook_status) OR public.has_role(auth.uid(), 'admin'::public.app_role))));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: certificate_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificate_types ENABLE ROW LEVEL SECURITY;

--
-- Name: logbook_crew; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logbook_crew ENABLE ROW LEVEL SECURITY;

--
-- Name: logbook_engine_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logbook_engine_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: logbooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: role_certificate_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_certificate_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: user_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_vessel_inductions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_vessel_inductions ENABLE ROW LEVEL SECURITY;

--
-- Name: vessel_crew_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vessel_crew_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: vessels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;