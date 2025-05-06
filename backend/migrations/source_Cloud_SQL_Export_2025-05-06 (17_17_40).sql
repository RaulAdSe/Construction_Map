--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12
-- Dumped by pg_dump version 15.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: sync_event_name_title(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_event_name_title() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- If only name is provided, copy to title
    IF NEW.name IS NOT NULL AND NEW.title IS NULL THEN
        NEW.title := NEW.name;
    -- If only title is provided, copy to name
    ELSIF NEW.title IS NOT NULL AND NEW.name IS NULL THEN
        NEW.name := NEW.title;
    END IF;
    
    -- Sync coordinates if one set is provided but not the other
    IF NEW.x_coordinate IS NOT NULL AND NEW.location_x IS NULL THEN
        NEW.location_x := NEW.x_coordinate;
        NEW.location_y := NEW.y_coordinate;
    ELSIF NEW.location_x IS NOT NULL AND NEW.x_coordinate IS NULL THEN
        NEW.x_coordinate := NEW.location_x;
        NEW.y_coordinate := NEW.location_y;
    END IF;
    
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: event_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_comments (
    id integer NOT NULL,
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    content character varying NOT NULL,
    image_url character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    comment_data json
);


--
-- Name: event_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_comments_id_seq OWNED BY public.event_comments.id;


--
-- Name: event_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_history (
    id integer NOT NULL,
    event_id integer NOT NULL,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status_from character varying(50),
    status_to character varying(50),
    notes text,
    user_id integer,
    action_type character varying(50),
    additional_data jsonb,
    previous_value character varying(255),
    new_value character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: event_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_history_id_seq OWNED BY public.event_history.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    map_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    location_x double precision,
    location_y double precision,
    event_type character varying(50),
    status character varying(50) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    image_url character varying(255),
    project_id integer,
    file_type character varying(50),
    state character varying(50),
    active_maps jsonb,
    tags jsonb,
    updated_at timestamp without time zone,
    created_by_user_id integer,
    title character varying(255),
    x_coordinate double precision,
    y_coordinate double precision
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: maps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maps (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    map_type character varying(50),
    filename character varying(255),
    version integer,
    transform_data jsonb,
    uploaded_at timestamp without time zone,
    file_url character varying
);


--
-- Name: maps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maps_id_seq OWNED BY public.maps.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    content text DEFAULT ''::text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    related_entity_type character varying(50),
    related_entity_id integer,
    message text,
    link text,
    notification_type text,
    read boolean DEFAULT false,
    event_id integer,
    comment_id integer
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: project_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_user (
    id integer NOT NULL,
    project_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: project_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_user_id_seq OWNED BY public.project_user.id;


--
-- Name: project_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_users (
    project_id integer NOT NULL,
    user_id integer NOT NULL,
    field character varying,
    joined_at timestamp without time zone,
    last_accessed_at timestamp without time zone
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: user_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activities (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    user_id integer,
    username character varying NOT NULL,
    action character varying NOT NULL,
    ip_address character varying,
    user_type character varying NOT NULL,
    details json
);


--
-- Name: user_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_activities_id_seq OWNED BY public.user_activities.id;


--
-- Name: user_preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preference (
    id integer NOT NULL,
    user_id integer,
    theme character varying(50) DEFAULT 'light'::character varying,
    notification_email boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_preference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_preference_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_preference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_preference_id_seq OWNED BY public.user_preference.id;


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email_notifications boolean
);


--
-- Name: user_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_preferences_id_seq OWNED BY public.user_preferences.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) DEFAULT '$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By'::character varying NOT NULL,
    is_admin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: event_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_comments ALTER COLUMN id SET DEFAULT nextval('public.event_comments_id_seq'::regclass);


--
-- Name: event_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_history ALTER COLUMN id SET DEFAULT nextval('public.event_history_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: maps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maps ALTER COLUMN id SET DEFAULT nextval('public.maps_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: project_user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_user ALTER COLUMN id SET DEFAULT nextval('public.project_user_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: user_activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities ALTER COLUMN id SET DEFAULT nextval('public.user_activities_id_seq'::regclass);


--
-- Name: user_preference id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference ALTER COLUMN id SET DEFAULT nextval('public.user_preference_id_seq'::regclass);


--
-- Name: user_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_preferences_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: event_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.event_comments (id, event_id, user_id, content, image_url, created_at, updated_at, comment_data) FROM stdin;
1	9	1	asd1	\N	2025-04-24 16:16:44.743662+00	\N	null
2	9	1	as	\N	2025-04-24 16:16:50.421483+00	\N	null
3	9	1	11	\N	2025-04-24 16:16:56.006454+00	\N	null
4	9	1	hi	\N	2025-04-24 16:17:28.575713+00	\N	null
5	9	1	@admin 	\N	2025-04-24 16:52:15.476258+00	\N	null
6	17	1	@admin 	\N	2025-04-24 17:03:51.977519+00	\N	null
7	9	1	lel	/comments/img_ffa7bff9-ae2e-4fd8-971e-f89212a9559b.png	2025-04-25 06:31:45.465639+00	\N	null
8	9	1	su\r\n	/comments/pdf_5b654efd-5555-48d8-b526-c0b048825133.pdf	2025-04-25 06:31:57.840469+00	\N	null
9	15	1	1	/comments/img_24881466-1e9c-4832-960e-97c84cc5f0e9.png	2025-04-29 10:37:10.488044+00	\N	null
10	16	1	hha @admin 	/comments/img_2b04f1ec-07d8-4afd-94d8-22fc7c24ed0d.png	2025-04-29 10:51:47.153795+00	\N	null
11	21	1	a	/comments/img_15efa028-163a-4dc8-81c6-acbe53a3d416.png	2025-04-29 11:36:48.485051+00	\N	null
12	17	1	Hola @admin 	/comments/img_acd3c2a0-f9ad-4852-9469-9c9b098685dd.png	2025-04-29 11:41:06.147886+00	\N	null
13	22	1	@admin mira esto	\N	2025-04-29 11:44:07.558373+00	\N	null
14	15	1	hola	/comments/img_8b1e5e64-64f8-41c6-8957-89413df5d50c.png	2025-04-29 21:30:05.728242+00	\N	null
15	16	1	hola	/comments/img_1159acac-4813-42e5-ba25-c49fc1a1a3fa.png	2025-04-30 08:05:13.429084+00	\N	null
16	28	1	asdasds	/comments/img_cca2bdaa-8cdb-4c00-9cc2-74c704c9c442.png	2025-04-30 10:00:01.645539+00	\N	null
17	16	1	a	/comments/img_67382640-418d-4b5f-8989-3d673b2034a4.png	2025-05-06 10:03:47.730794+00	\N	null
\.


--
-- Data for Name: event_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.event_history (id, event_id, changed_by, changed_at, status_from, status_to, notes, user_id, action_type, additional_data, previous_value, new_value, created_at) FROM stdin;
1	13	\N	2025-04-24 15:31:30.96461	\N	\N	\N	1	create	null	\N	open	2025-04-24 15:31:30.96461
2	14	\N	2025-04-24 15:32:04.004691	\N	\N	\N	1	create	null	\N	open	2025-04-24 15:32:04.004691
3	15	\N	2025-04-24 15:41:29.288139	\N	\N	\N	1	create	null	\N	open	2025-04-24 15:41:29.288139
4	13	\N	2025-04-24 15:41:59.123923	\N	\N	\N	1	status_change	null	open	closed	2025-04-24 15:41:59.123923
5	12	\N	2025-04-24 15:42:06.179086	\N	\N	\N	1	status_change	null	open	closed	2025-04-24 15:42:06.179086
6	11	\N	2025-04-24 15:42:10.841795	\N	\N	\N	1	status_change	null	open	closed	2025-04-24 15:42:10.841795
7	16	\N	2025-04-24 15:44:40.116409	\N	\N	\N	1	create	null	\N	open	2025-04-24 15:44:40.116409
8	17	\N	2025-04-24 16:00:57.510632	\N	\N	\N	1	create	null	\N	open	2025-04-24 16:00:57.510632
9	16	\N	2025-04-24 16:14:57.669493	\N	\N	\N	1	type_change	null	periodic check	incidence	2025-04-24 16:14:57.669493
10	16	\N	2025-04-24 16:14:58.921759	\N	\N	\N	1	type_change	null	incidence	periodic check	2025-04-24 16:14:58.921759
11	16	\N	2025-04-24 16:15:03.824322	\N	\N	\N	1	type_change	null	periodic check	incidence	2025-04-24 16:15:03.824322
12	16	\N	2025-04-24 16:15:05.652498	\N	\N	\N	1	status_change	null	open	in-progress	2025-04-24 16:15:05.652498
13	9	\N	2025-04-24 16:16:44.743662	\N	\N	\N	1	comment	{"comment_id": 1}	\N	asd1	2025-04-24 16:16:44.743662
14	9	\N	2025-04-24 16:16:50.421483	\N	\N	\N	1	comment	{"comment_id": 2}	\N	as	2025-04-24 16:16:50.421483
15	9	\N	2025-04-24 16:16:56.006454	\N	\N	\N	1	comment	{"comment_id": 3}	\N	11	2025-04-24 16:16:56.006454
16	9	\N	2025-04-24 16:17:28.575713	\N	\N	\N	1	comment	{"comment_id": 4}	\N	hi	2025-04-24 16:17:28.575713
17	9	\N	2025-04-24 16:52:15.476258	\N	\N	\N	1	comment	{"comment_id": 5}	\N	@admin 	2025-04-24 16:52:15.476258
18	17	\N	2025-04-24 17:03:51.977519	\N	\N	\N	1	comment	{"comment_id": 6}	\N	@admin 	2025-04-24 17:03:51.977519
19	18	\N	2025-04-25 07:24:38.018708	\N	\N	\N	1	create	null	\N	open	2025-04-25 07:24:38.018708
20	19	\N	2025-04-25 12:55:07.533029	\N	\N	\N	1	create	null	\N	open	2025-04-25 12:55:07.533029
21	20	\N	2025-04-25 12:57:09.414262	\N	\N	\N	1	create	null	\N	open	2025-04-25 12:57:09.414262
22	14	\N	2025-04-28 10:08:17.280825	\N	\N	\N	1	status_change	null	open	in-progress	2025-04-28 10:08:17.280825
23	14	\N	2025-04-28 10:08:29.533094	\N	\N	\N	1	status_change	null	in-progress	resolved	2025-04-28 10:08:29.533094
24	14	\N	2025-04-28 10:08:45.727953	\N	\N	\N	1	status_change	null	resolved	in-progress	2025-04-28 10:08:45.727953
25	16	\N	2025-04-28 10:32:17.275109	\N	\N	\N	1	status_change	null	in-progress	resolved	2025-04-28 10:32:17.275109
26	14	\N	2025-04-28 10:32:20.664021	\N	\N	\N	1	status_change	null	in-progress	open	2025-04-28 10:32:20.664021
27	14	\N	2025-04-28 10:32:24.349665	\N	\N	\N	1	status_change	null	open	in-progress	2025-04-28 10:32:24.349665
28	16	\N	2025-04-28 10:32:48.813108	\N	\N	\N	1	type_change	null	incidence	periodic check	2025-04-28 10:32:48.813108
29	16	\N	2025-04-28 10:32:51.637504	\N	\N	\N	1	type_change	null	periodic check	incidence	2025-04-28 10:32:51.637504
30	16	\N	2025-04-28 10:32:53.201881	\N	\N	\N	1	status_change	null	resolved	in-progress	2025-04-28 10:32:53.201881
31	16	\N	2025-04-28 10:32:57.162413	\N	\N	\N	1	status_change	null	in-progress	resolved	2025-04-28 10:32:57.162413
32	16	\N	2025-04-29 08:20:06.686442	\N	\N	\N	1	status_change	null	resolved	in-progress	2025-04-29 08:20:06.686442
33	14	\N	2025-04-29 08:20:12.266569	\N	\N	\N	1	status_change	null	in-progress	open	2025-04-29 08:20:12.266569
34	14	\N	2025-04-29 08:20:15.201919	\N	\N	\N	1	status_change	null	open	resolved	2025-04-29 08:20:15.201919
35	9	\N	2025-04-29 08:20:30.176348	\N	\N	\N	1	status_change	null	open	closed	2025-04-29 08:20:30.176348
36	9	\N	2025-04-29 08:20:31.451228	\N	\N	\N	1	status_change	null	closed	open	2025-04-29 08:20:31.451228
37	9	\N	2025-04-29 08:21:59.625615	\N	\N	\N	1	status_change	null	open	closed	2025-04-29 08:21:59.625615
38	14	\N	2025-04-29 09:42:51.040957	\N	\N	\N	1	status_change	null	resolved	in-progress	2025-04-29 09:42:51.040957
39	14	\N	2025-04-29 09:42:54.066998	\N	\N	\N	1	status_change	null	in-progress	open	2025-04-29 09:42:54.066998
40	21	\N	2025-04-29 11:36:34.536309	\N	\N	\N	1	create	null	\N	open	2025-04-29 11:36:34.536309
41	22	\N	2025-04-29 11:43:53.596119	\N	\N	\N	1	create	null	\N	resolved	2025-04-29 11:43:53.596119
42	22	\N	2025-04-29 11:44:07.558373	\N	\N	\N	1	comment	{"comment_id": 13}	\N	@admin mira esto	2025-04-29 11:44:07.558373
43	22	\N	2025-04-29 11:44:12.857797	\N	\N	\N	1	status_change	null	resolved	in-progress	2025-04-29 11:44:12.857797
44	22	\N	2025-04-29 11:46:27.532456	\N	\N	\N	1	status_change	null	in-progress	resolved	2025-04-29 11:46:27.532456
45	22	\N	2025-04-29 11:46:29.216421	\N	\N	\N	1	status_change	null	resolved	in-progress	2025-04-29 11:46:29.216421
46	22	\N	2025-04-29 11:46:30.625032	\N	\N	\N	1	status_change	null	in-progress	resolved	2025-04-29 11:46:30.625032
47	23	\N	2025-04-30 08:03:05.058708	\N	\N	\N	1	create	null	\N	open	2025-04-30 08:03:05.058708
50	26	\N	2025-04-30 08:24:40.544072	\N	\N	\N	1	create	null	\N	open	2025-04-30 08:24:40.544072
51	27	\N	2025-04-30 08:25:04.200623	\N	\N	\N	1	create	null	\N	open	2025-04-30 08:25:04.200623
52	28	\N	2025-04-30 09:59:01.001326	\N	\N	\N	1	create	null	\N	open	2025-04-30 09:59:01.001326
53	29	\N	2025-04-30 09:59:17.560926	\N	\N	\N	1	create	null	\N	open	2025-04-30 09:59:17.560926
56	32	\N	2025-04-30 11:10:11.570639	\N	\N	\N	1	create	null	\N	open	2025-04-30 11:10:11.570639
57	33	\N	2025-04-30 11:10:18.878814	\N	\N	\N	1	create	null	\N	open	2025-04-30 11:10:18.878814
58	34	\N	2025-04-30 11:11:22.931029	\N	\N	\N	1	create	null	\N	open	2025-04-30 11:11:22.931029
59	35	\N	2025-04-30 11:17:01.732025	\N	\N	\N	1	create	null	\N	open	2025-04-30 11:17:01.732025
60	36	\N	2025-05-06 09:51:25.91527	\N	\N	\N	1	create	null	\N	open	2025-05-06 09:51:25.91527
61	37	\N	2025-05-06 10:05:38.172174	\N	\N	\N	1	create	null	\N	open	2025-05-06 10:05:38.172174
62	38	\N	2025-05-06 12:54:31.795062	\N	\N	\N	1	create	null	\N	open	2025-05-06 12:54:31.795062
64	40	\N	2025-05-06 12:57:39.781418	\N	\N	\N	1	create	null	\N	open	2025-05-06 12:57:39.781418
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, map_id, name, description, location_x, location_y, event_type, status, created_at, created_by, image_url, project_id, file_type, state, active_maps, tags, updated_at, created_by_user_id, title, x_coordinate, y_coordinate) FROM stdin;
10	13	1	\N	166.97653370558763	175.45832193025197	\N	open	2025-04-24 15:08:52.95905	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	1	166.97653370558763	175.45832193025197
15	13	prueba	\N	200.90644782772503	196.19326944933596	\N	open	2025-04-24 15:41:29.227765	\N	events/img_5127fb6b-51e3-4ab5-9727-4c700f615bb2.jpeg	1	image	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	prueba	200.90644782772503	196.19326944933596
13	13	1	\N	249.91632378192352	230.12318357147336	\N	closed	2025-04-24 15:31:30.914596	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	2025-04-24 15:41:59.071458	1	1	249.91632378192352	230.12318357147336
12	13	1	\N	291.38621882009147	224.46819788445046	\N	closed	2025-04-24 15:29:19.173798	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	2025-04-24 15:42:06.130245	1	1	291.38621882009147	224.46819788445046
11	13	1	\N	272.5362665300151	221.640705040939	\N	closed	2025-04-24 15:24:22.103059	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	2025-04-24 15:42:10.780595	1	1	272.5362665300151	221.640705040939
17	13	123312	dsa	128.33413151093114	196.19326944933596	\N	open	2025-04-24 16:00:57.458676	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	123312	128.33413151093114	196.19326944933596
29	13	1	\N	387.3028234056649	232.2183597176744	\N	open	2025-04-30 09:59:17.500563	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	1	387.3028234056649	232.2183597176744
9	13	asdasd	saads	246.14633332390824	142.4709054226184	\N	closed	2025-04-24 14:22:34.375404	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	2025-04-29 08:21:59.575813	1	asdasd	246.14633332390824	142.4709054226184
18	13	ew	\N	558.1130437246717	246.61689182529017	\N	open	2025-04-25 07:24:37.952145	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	ew	558.1130437246717	246.61689182529017
19	13	adsdasas	\N	517.6301248225116	517.7911369167241	\N	open	2025-04-25 12:55:07.46533	\N	events/img_6fc8d33e-a337-4975-8c5f-ab178039c241.jpeg	1	image	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}, "14": {"opacity": {"opacity": 100, "visible": false}}}	null	\N	1	adsdasas	517.6301248225116	517.7911369167241
20	13	asdasdas	\N	352.0548340339019	336.1639745960494	\N	open	2025-04-25 12:57:09.351329	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	asdasdas	352.0548340339019	336.1639745960494
32	13	asdasdads	\N	250.30182036163802	297.21883561447544	\N	open	2025-04-30 11:10:11.472821	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	asdasdads	250.30182036163802	297.21883561447544
14	13	123123	\N	300.81119496512963	151.89588156765655	\N	open	2025-04-24 15:32:03.944591	\N	\N	1	\N	incidence	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	2025-04-29 09:42:54.019952	1	123123	300.81119496512963	151.89588156765655
21	13	aa	\N	460.0781463165254	233.80555436161274	\N	open	2025-04-29 11:36:34.459283	\N	events/img_e46791da-ac95-4ac4-9f4c-d286d698cd4f.png	1	image	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	aa	460.0781463165254	233.80555436161274
33	13	asddasadsa	\N	60.300429278680994	52.21704184960984	\N	open	2025-04-30 11:10:18.810722	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	asddasadsa	60.300429278680994	52.21704184960984
34	16	assadads	\N	482.3035189471434	190.218052215126	\N	open	2025-04-30 11:11:22.850789	\N	\N	6	\N	periodic check	{"16": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	assadads	482.3035189471434	190.218052215126
35	13	123132	\N	240.30174714674553	154.21778864151307	\N	open	2025-04-30 11:17:01.67168	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	123132	240.30174714674553	154.21778864151307
22	16	Prueba	\N	62.524692898139925	49.928019012657366	\N	resolved	2025-04-29 11:43:53.511144	\N	events/img_45cee6d8-786f-4a2c-98ae-f603cb3b3cbf.png	6	image	incidence	{"16": {"opacity": {"opacity": 100, "visible": true}}}	null	2025-04-29 11:46:30.545889	1	Prueba	62.524692898139925	49.928019012657366
23	13	hola	\N	350.05469316020486	189.16406309382336	\N	open	2025-04-30 08:03:04.977329	\N	events/img_0fb31831-1baf-4690-99e5-a4b048abb5cb.png	1	image	request	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	hola	350.05469316020486	189.16406309382336
16	13	4214	asd	279.1337498315418	191.48078137681688	\N	in-progress	2025-04-24 15:44:40.056244	\N	\N	1	\N	incidence	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	2025-04-29 08:20:06.619234	1	4214	279.1337498315418	191.48078137681688
36	13	hola	\N	25.70641463722862	58.421775519088705	\N	open	2025-05-06 09:51:25.818709	\N	\N	1	\N	incidence	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	hola	25.70641463722862	58.421775519088705
26	16	1e221	\N	502.0544543793369	273.1641340509667	\N	open	2025-04-30 08:24:40.484709	\N	\N	6	\N	periodic check	{"16": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	1e221	502.0544543793369	273.1641340509667
27	16	qfwewqd	\N	310.0549403371801	155.16443271255778	\N	open	2025-04-30 08:25:04.13646	\N	\N	6	\N	request	{"16": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	qfwewqd	310.0549403371801	155.16443271255778
28	16	hey	\N	32.96675149365015	44.38805708398185	\N	open	2025-04-30 09:59:00.929778	\N	\N	6	\N	periodic check	{"16": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	hey	32.96675149365015	44.38805708398185
37	13	prueba	\N	33.912247915320286	59.86139526594146	\N	open	2025-05-06 10:05:38.114972	\N	events/img_72be06f1-1e89-40fd-8041-6798c4069b19.png	1	image	incidence	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	prueba	33.912247915320286	59.86139526594146
38	13	Hi	\N	57.22784198194958	23.253621065833865	\N	open	2025-05-06 12:54:31.740413	\N	\N	1	\N	periodic check	{"13": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	Hi	57.22784198194958	23.253621065833865
40	22	Hi	\N	64.81112471741663	48.2932434872799	\N	open	2025-05-06 12:57:39.730725	\N	\N	11	\N	periodic check	{"22": {"opacity": {"opacity": 100, "visible": true}}}	null	\N	1	Hi	64.81112471741663	48.2932434872799
\.


--
-- Data for Name: maps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maps (id, project_id, name, description, created_at, created_by, map_type, filename, version, transform_data, uploaded_at, file_url) FROM stdin;
14	1	2	\N	2025-04-24 12:12:40.354033	\N	overlay	d4b45656-3d79-496c-8255-709d6666f8b6.pdf	1	null	2025-04-24 12:12:40.581813	https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/maps/d4b45656-3d79-496c-8255-709d6666f8b6.pdf
13	1	1	\N	2025-04-24 12:10:55.77584	\N	implantation	a2a1126e-e4d8-42af-bb04-5fd3f6a57f61.pdf	1	null	2025-04-24 12:10:56.084388	https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/maps/a2a1126e-e4d8-42af-bb04-5fd3f6a57f61.pdf
16	6	Implantación	\N	2025-04-29 11:42:23.213756	\N	implantation	ad4f7e4b-e0f5-4f83-abfb-3a065acdbd9c.pdf	1	null	2025-04-29 11:42:23.457988	https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/maps/ad4f7e4b-e0f5-4f83-abfb-3a065acdbd9c.pdf
17	6	pararayos	\N	2025-04-29 11:45:27.948052	\N	overlay	bf3bd15b-0323-4e02-ae26-2cd5cd2576f7.pdf	1	null	2025-04-29 11:45:28.182289	https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/maps/bf3bd15b-0323-4e02-ae26-2cd5cd2576f7.pdf
22	11	1	\N	2025-05-06 12:57:07.207495	\N	implantation	a11d14f1-ff64-4b8d-8ec6-b513e2f106aa.pdf	1	null	2025-05-06 12:57:07.40069	https://storage.googleapis.com/construction-map-storage-deep-responder-444017-h2/maps/a11d14f1-ff64-4b8d-8ec6-b513e2f106aa.pdf
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, content, is_read, created_at, related_entity_type, related_entity_id, message, link, notification_type, read, event_id, comment_id) FROM stdin;
3	1		f	2025-04-29 11:44:07.658569	\N	\N	You were mentioned in a comment 'Prueba'	/project/6?event=22&comment=13	mention	t	22	13
\.


--
-- Data for Name: project_user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_user (id, project_id, user_id) FROM stdin;
\.


--
-- Data for Name: project_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_users (project_id, user_id, field, joined_at, last_accessed_at) FROM stdin;
1	1	administrador	2025-04-16 15:23:31.536861	2025-04-29 09:44:48.19375
6	1		2025-04-29 11:41:54.624658	2025-04-29 11:41:54.624662
11	1	asdasds	2025-05-06 12:56:47.535971	2025-05-06 13:14:28.739695
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, description, is_active, created_at, created_by) FROM stdin;
1	Prueba	Prueba	t	2025-04-16 15:23:31.480761	\N
6	Demo		t	2025-04-29 11:41:54.578144	\N
11	mapmap		t	2025-05-06 12:56:47.496476	\N
\.


--
-- Data for Name: user_activities; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_activities (id, "timestamp", user_id, username, action, ip_address, user_type, details) FROM stdin;
3	2025-04-16 10:41:23.730761+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
4	2025-04-16 10:41:27.796141+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
5	2025-04-16 10:42:46.635242+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
6	2025-04-16 10:48:05.960154+00	1	admin	login_success	169.254.169.126	admin	{}
7	2025-04-16 11:23:17.834157+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
8	2025-04-16 11:32:39.78006+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
9	2025-04-16 11:36:56.662096+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
10	2025-04-16 11:38:12.047778+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
11	2025-04-16 11:38:15.907902+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
12	2025-04-16 11:46:43.097291+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
13	2025-04-16 12:08:59.169221+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
14	2025-04-16 12:18:52.358137+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
15	2025-04-16 12:19:25.691795+00	\N	a	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
16	2025-04-16 12:19:35.39592+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
17	2025-04-16 12:19:56.432952+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
18	2025-04-16 12:22:18.256946+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
19	2025-04-16 12:33:59.934097+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
20	2025-04-16 12:36:38.53943+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
21	2025-04-16 12:40:00.035341+00	1	admin	login_success	169.254.169.126	admin	{}
22	2025-04-16 12:44:56.419113+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
23	2025-04-16 12:44:57.335089+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
24	2025-04-16 12:44:58.188354+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
25	2025-04-16 12:44:58.995363+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
26	2025-04-16 12:45:00.238331+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
27	2025-04-16 12:45:00.812712+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
28	2025-04-16 12:45:01.758167+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
29	2025-04-16 12:45:02.563624+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
30	2025-04-16 12:45:02.951289+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
31	2025-04-16 12:45:03.284164+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
32	2025-04-16 12:45:03.569234+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
33	2025-04-16 12:45:03.876552+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
34	2025-04-16 12:45:04.187178+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
35	2025-04-16 12:45:04.549955+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
36	2025-04-16 12:45:08.400599+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
37	2025-04-16 12:45:08.744423+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
38	2025-04-16 12:45:09.140425+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
39	2025-04-16 12:45:09.422493+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
40	2025-04-16 12:45:09.725732+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
41	2025-04-16 12:45:10.002048+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
42	2025-04-16 12:45:10.414052+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
43	2025-04-16 12:45:10.718921+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
44	2025-04-16 12:45:11.146832+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
45	2025-04-16 12:45:11.708211+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
46	2025-04-16 12:45:12.019537+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
47	2025-04-16 12:45:12.325026+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
48	2025-04-16 12:45:12.639139+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
49	2025-04-16 12:45:12.962073+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
50	2025-04-16 12:45:13.303511+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
51	2025-04-16 12:45:13.565915+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
52	2025-04-16 12:45:13.857544+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
53	2025-04-16 12:45:14.139912+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
54	2025-04-16 12:45:14.445236+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
55	2025-04-16 12:45:14.724322+00	\N	1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
56	2025-04-16 12:53:31.573454+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
57	2025-04-16 12:53:38.560654+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
58	2025-04-16 12:53:59.677913+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
59	2025-04-16 12:55:21.360174+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
60	2025-04-16 12:55:36.704695+00	1	admin	login_success	169.254.169.126	admin	{}
61	2025-04-16 12:55:47.340659+00	1	admin	login_success	169.254.169.126	admin	{}
62	2025-04-16 12:55:52.387082+00	1	admin	login_success	169.254.169.126	admin	{}
63	2025-04-16 13:21:04.826304+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
64	2025-04-16 13:21:35.956234+00	1	admin	login_success	169.254.169.126	admin	{}
65	2025-04-16 13:34:16.346108+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
66	2025-04-16 13:34:23.461733+00	1	admin	login_success	169.254.169.126	admin	{}
67	2025-04-16 13:47:57.595128+00	1	admin	login_success	169.254.169.126	admin	{}
68	2025-04-16 13:48:12.228809+00	1	admin	login_success	169.254.169.126	admin	{}
69	2025-04-16 13:48:20.105762+00	1	admin	login_success	169.254.169.126	admin	{}
70	2025-04-16 13:48:26.514813+00	1	admin	login_success	169.254.169.126	admin	{}
71	2025-04-16 13:48:29.781999+00	1	admin	login_success	169.254.169.126	admin	{}
72	2025-04-16 13:51:24.396226+00	1	admin	login_success	169.254.169.126	admin	{}
73	2025-04-16 13:52:26.574499+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
74	2025-04-16 13:52:33.261425+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
75	2025-04-16 14:00:54.875921+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
76	2025-04-16 14:01:01.633778+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
77	2025-04-16 14:02:05.269913+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
78	2025-04-16 14:09:01.703931+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
79	2025-04-16 14:10:26.399148+00	1	admin	login_success	169.254.169.126	admin	{}
80	2025-04-16 14:56:16.103082+00	1	admin	login_success	169.254.169.126	admin	{}
81	2025-04-16 15:22:32.686903+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
82	2025-04-16 15:23:03.338233+00	1	admin	login_success	169.254.169.126	admin	{}
83	2025-04-16 15:25:03.52723+00	1	admin	login_success	169.254.169.126	admin	{}
84	2025-04-16 15:25:50.688505+00	1	admin	login_success	169.254.169.126	admin	{}
85	2025-04-16 15:33:16.815711+00	1	admin	login_success	169.254.169.126	admin	{}
86	2025-04-16 16:10:12.482944+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
87	2025-04-16 16:10:18.828706+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
88	2025-04-16 16:10:26.909388+00	1	admin	login_success	169.254.169.126	admin	{}
89	2025-04-16 16:12:37.982291+00	1	admin	login_success	169.254.169.126	admin	{}
90	2025-04-16 17:06:15.634445+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
91	2025-04-16 17:06:31.146472+00	1	admin	login_success	169.254.169.126	admin	{}
92	2025-04-16 17:27:26.886747+00	1	admin	login_success	169.254.169.126	admin	{}
93	2025-04-16 17:45:52.842928+00	1	admin	login_success	169.254.169.126	admin	{}
94	2025-04-16 17:54:07.073099+00	1	admin	login_success	169.254.169.126	admin	{}
95	2025-04-22 07:05:15.779774+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
96	2025-04-22 07:07:13.975303+00	1	admin	login_success	169.254.169.126	admin	{}
97	2025-04-22 07:47:19.693922+00	1	admin	login_success	169.254.169.126	admin	{}
98	2025-04-22 07:59:12.536392+00	1	admin	login_success	169.254.169.126	admin	{}
99	2025-04-22 08:05:59.306376+00	1	admin	login_success	169.254.169.126	admin	{}
100	2025-04-22 08:39:01.429345+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
101	2025-04-22 08:40:03.989764+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
102	2025-04-22 08:45:54.925964+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
103	2025-04-22 08:46:00.107315+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
104	2025-04-22 08:46:16.298087+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
105	2025-04-22 08:47:52.429195+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
106	2025-04-22 08:51:04.675461+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
107	2025-04-22 08:51:21.671309+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
108	2025-04-22 08:52:02.7773+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
109	2025-04-22 08:53:18.63517+00	\N	admin1	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
110	2025-04-22 08:53:24.435487+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
111	2025-04-22 09:03:26.454242+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
112	2025-04-22 09:03:33.260261+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
113	2025-04-22 09:05:15.747545+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
114	2025-04-22 09:07:03.952926+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
115	2025-04-22 09:07:22.476138+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
116	2025-04-22 09:21:34.319325+00	1	admin	login_success	169.254.169.126	admin	{}
117	2025-04-22 09:32:19.340603+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
118	2025-04-22 09:32:49.422193+00	1	admin	login_success	169.254.169.126	admin	{}
119	2025-04-22 09:49:54.893358+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
120	2025-04-22 09:50:08.284797+00	1	admin	login_success	169.254.169.126	admin	{}
121	2025-04-22 10:20:29.167346+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
122	2025-04-22 10:20:45.112228+00	1	admin	login_success	169.254.169.126	admin	{}
123	2025-04-22 10:40:35.126069+00	1	admin	login_success	169.254.169.126	admin	{}
124	2025-04-22 10:40:54.865373+00	1	admin	login_success	169.254.169.126	admin	{}
125	2025-04-22 10:50:34.730124+00	1	admin	login_success	169.254.169.126	admin	{}
126	2025-04-22 11:08:36.056908+00	1	admin	login_success	169.254.169.126	admin	{}
127	2025-04-22 11:16:55.397902+00	1	admin	login_success	169.254.169.126	admin	{}
128	2025-04-22 14:54:56.446185+00	1	admin	login_success	169.254.169.126	admin	{}
129	2025-04-22 14:55:22.504089+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "implantation"}
130	2025-04-22 15:03:59.934633+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 2, "map_name": "1", "map_type": "implantation"}
131	2025-04-22 15:07:11.928816+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 3, "map_name": "1", "map_type": "implantation"}
132	2025-04-22 15:15:03.971108+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 4, "map_name": "1", "map_type": "implantation"}
133	2025-04-22 15:15:30.088352+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 5, "map_name": "1", "map_type": "implantation"}
134	2025-04-22 15:28:17.096266+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
135	2025-04-22 15:28:25.641085+00	1	admin	login_success	169.254.169.126	admin	{}
136	2025-04-22 15:28:40.375935+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 6, "map_name": "1", "map_type": "implantation"}
137	2025-04-22 15:29:59.116283+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 7, "map_name": "1", "map_type": "implantation"}
138	2025-04-22 15:59:21.237953+00	1	admin	login_success	169.254.169.126	admin	{}
139	2025-04-22 16:13:06.186643+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 8, "map_name": "1", "map_type": "overlay"}
140	2025-04-22 16:13:09.953292+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 8, "map_name": "1", "map_type": "implantation"}
141	2025-04-22 16:13:34.890262+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 9, "map_name": "1", "map_type": "overlay"}
142	2025-04-22 16:13:37.822151+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 9, "map_name": "1", "map_type": "implantation"}
143	2025-04-22 16:25:39.827471+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 10, "map_name": "1", "map_type": "implantation"}
144	2025-04-22 16:27:45.681696+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 11, "map_name": "1", "map_type": "implantation"}
145	2025-04-22 16:30:52.556817+00	1	admin	login_success	169.254.169.126	admin	{}
146	2025-04-22 16:31:04.501947+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 12, "map_name": "1", "map_type": "implantation"}
147	2025-04-22 17:21:13.760078+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
148	2025-04-22 17:21:16.256008+00	1	admin	login_success	169.254.169.126	admin	{}
149	2025-04-22 17:49:33.253316+00	1	admin	login_success	169.254.169.126	admin	{}
150	2025-04-22 18:29:29.751652+00	1	admin	login_success	169.254.169.126	admin	{}
151	2025-04-22 18:40:13.508776+00	1	admin	login_success	169.254.169.126	admin	{}
152	2025-04-22 18:50:50.255342+00	1	admin	login_success	169.254.169.126	admin	{}
153	2025-04-22 19:00:53.145972+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
154	2025-04-22 19:01:01.944424+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
155	2025-04-22 19:01:05.426849+00	1	admin	login_success	169.254.169.126	admin	{}
156	2025-04-22 19:34:02.017519+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
157	2025-04-22 19:34:14.976716+00	1	admin	login_success	169.254.169.126	admin	{}
158	2025-04-22 19:35:36.730121+00	1	admin	login_success	169.254.169.126	admin	{}
159	2025-04-22 20:06:40.193932+00	1	admin	login_success	169.254.169.126	admin	{}
160	2025-04-22 20:42:39.961905+00	1	admin	login_success	169.254.169.126	admin	{}
161	2025-04-22 20:53:38.085623+00	1	admin	login_success	169.254.169.126	admin	{}
162	2025-04-22 21:40:10.488221+00	1	admin	login_success	169.254.169.126	admin	{}
163	2025-04-23 07:22:44.494787+00	1	admin	login_success	169.254.169.126	admin	{}
164	2025-04-23 08:23:07.378916+00	1	admin	login_success	169.254.169.126	admin	{}
165	2025-04-23 09:17:51.202692+00	1	admin	login_success	169.254.169.126	admin	{}
166	2025-04-23 09:58:01.552044+00	1	admin	login_success	169.254.169.126	admin	{}
167	2025-04-23 10:32:48.136172+00	1	admin	login_success	169.254.169.126	admin	{}
168	2025-04-23 11:06:19.159137+00	1	admin	login_success	169.254.169.126	admin	{}
169	2025-04-23 11:39:59.808214+00	1	admin	login_success	169.254.169.126	admin	{}
170	2025-04-23 13:10:21.165362+00	1	admin	login_success	169.254.169.126	admin	{}
171	2025-04-23 13:34:56.025253+00	1	admin	login_success	169.254.169.126	admin	{}
172	2025-04-23 14:28:24.010777+00	1	admin	login_success	169.254.169.126	admin	{}
173	2025-04-23 15:09:31.008803+00	1	admin	login_success	169.254.169.126	admin	{}
174	2025-04-23 15:55:28.122099+00	1	admin	login_success	169.254.169.126	admin	{}
175	2025-04-23 16:40:02.046049+00	1	admin	login_success	169.254.169.126	admin	{}
176	2025-04-23 17:44:56.894308+00	1	admin	login_success	169.254.169.126	admin	{}
177	2025-04-24 07:16:05.185339+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
178	2025-04-24 07:16:31.079524+00	1	admin	login_success	169.254.169.126	admin	{}
179	2025-04-24 07:57:12.395418+00	1	admin	login_success	169.254.169.126	admin	{}
180	2025-04-24 08:28:14.111109+00	1	admin	login_success	169.254.169.126	admin	{}
181	2025-04-24 08:57:21.984134+00	1	admin	login_success	169.254.169.126	admin	{}
182	2025-04-24 09:20:31.143607+00	1	admin	login_success	169.254.169.126	admin	{}
183	2025-04-24 11:09:16.653918+00	1	admin	login_success	169.254.169.126	admin	{}
184	2025-04-24 11:39:39.038432+00	1	admin	login_success	169.254.169.126	admin	{}
185	2025-04-24 11:39:58.877613+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 8, "map_name": "1", "map_type": "implantation"}
186	2025-04-24 11:39:59.783019+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 9, "map_name": "1", "map_type": "implantation"}
187	2025-04-24 11:40:00.591517+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 10, "map_name": "1", "map_type": "implantation"}
188	2025-04-24 11:46:39.198028+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 11, "map_name": "1", "map_type": "implantation"}
189	2025-04-24 11:48:32.213336+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 6, "map_name": "1", "map_type": "implantation"}
190	2025-04-24 11:48:32.634922+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "overlay"}
191	2025-04-24 11:48:32.870202+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "implantation"}
192	2025-04-24 11:48:33.208302+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 5, "map_name": "1", "map_type": "implantation"}
193	2025-04-24 11:48:33.467262+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "overlay"}
194	2025-04-24 11:48:33.673254+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "implantation"}
195	2025-04-24 11:48:33.98071+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 4, "map_name": "1", "map_type": "implantation"}
196	2025-04-24 11:48:34.268447+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "overlay"}
197	2025-04-24 11:48:34.50981+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "implantation"}
198	2025-04-24 11:48:41.452224+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 7, "map_name": "1", "map_type": "implantation"}
199	2025-04-24 11:48:41.834039+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 2, "map_name": "1", "map_type": "overlay"}
200	2025-04-24 11:48:42.050461+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "implantation"}
202	2025-04-24 11:48:46.600619+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "overlay"}
203	2025-04-24 11:48:46.839176+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "implantation"}
204	2025-04-24 11:48:48.18793+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 2, "map_name": "1", "map_type": "overlay"}
201	2025-04-24 11:48:46.358044+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 3, "map_name": "1", "map_type": "implantation"}
206	2025-04-24 11:48:59.052277+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 1, "map_name": "1", "map_type": "implantation"}
205	2025-04-24 11:48:53.129044+00	1	admin	map_delete	169.254.169.126	admin	{"project_id": 1, "map_id": 12, "map_name": "1", "map_type": "implantation"}
207	2025-04-24 12:10:38.157191+00	1	admin	login_success	169.254.169.126	admin	{}
208	2025-04-24 12:10:56.137087+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "map_name": "1", "map_type": "implantation"}
209	2025-04-24 12:12:40.616527+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 1, "map_id": 14, "map_name": "2", "map_type": "overlay"}
210	2025-04-24 12:40:50.440805+00	1	admin	login_success	169.254.169.126	admin	{}
211	2025-04-24 12:52:13.834049+00	1	admin	login_success	169.254.169.126	admin	{}
212	2025-04-24 13:00:15.342462+00	1	admin	login_success	169.254.169.126	admin	{}
213	2025-04-24 13:37:18.046501+00	1	admin	login_success	169.254.169.126	admin	{}
214	2025-04-24 14:06:55.31461+00	1	admin	login_success	169.254.169.126	admin	{}
215	2025-04-24 14:55:54.265452+00	1	admin	login_success	169.254.169.126	admin	{}
216	2025-04-24 15:24:06.601368+00	1	admin	login_success	169.254.169.126	admin	{}
217	2025-04-24 15:24:07.531538+00	1	admin	login_success	169.254.169.126	admin	{}
218	2025-04-24 15:31:31.018396+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 13, "event_title": "1", "event_status": "open", "event_state": "periodic check"}
219	2025-04-24 15:32:04.057482+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 14, "event_title": "123123", "event_status": "open", "event_state": "incidence"}
220	2025-04-24 15:41:29.337313+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 15, "event_title": "prueba", "event_status": "open", "event_state": "periodic check"}
221	2025-04-24 15:41:59.170072+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 13, "project_id": 1, "map_id": 13, "event_title": "1", "event_status": "closed", "event_state": "periodic check", "status_changed": false, "state_changed": false}
222	2025-04-24 15:42:06.220527+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 12, "project_id": 1, "map_id": 13, "event_title": "1", "event_status": "closed", "event_state": "periodic check", "status_changed": false, "state_changed": false}
223	2025-04-24 15:42:10.881056+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 11, "project_id": 1, "map_id": 13, "event_title": "1", "event_status": "closed", "event_state": "periodic check", "status_changed": false, "state_changed": false}
224	2025-04-24 15:44:40.179668+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 16, "event_title": "4214", "event_status": "open", "event_state": "periodic check"}
225	2025-04-24 15:55:18.018632+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
226	2025-04-24 15:55:21.4631+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
227	2025-04-24 15:55:23.951093+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
228	2025-04-24 15:55:30.566899+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
229	2025-04-24 15:56:42.662666+00	1	admin	login_success	169.254.169.126	admin	{}
230	2025-04-24 16:00:57.563286+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 17, "event_title": "123312", "event_status": "open", "event_state": "periodic check"}
231	2025-04-24 16:14:57.728163+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "open", "event_state": "incidence", "status_changed": false, "state_changed": false}
232	2025-04-24 16:14:58.966278+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "open", "event_state": "periodic check", "status_changed": false, "state_changed": false}
233	2025-04-24 16:15:03.862877+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "open", "event_state": "incidence", "status_changed": false, "state_changed": false}
234	2025-04-24 16:15:05.689233+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
235	2025-04-24 16:16:44.86308+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 9, "comment_id": 1, "project_id": 1, "has_image": false, "event_title": "asdasd"}
236	2025-04-24 16:16:50.544748+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 9, "comment_id": 2, "project_id": 1, "has_image": false, "event_title": "asdasd"}
237	2025-04-24 16:16:56.135913+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 9, "comment_id": 3, "project_id": 1, "has_image": false, "event_title": "asdasd"}
238	2025-04-24 16:17:28.672232+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 9, "comment_id": 4, "project_id": 1, "has_image": false, "event_title": "asdasd"}
239	2025-04-24 16:37:35.349202+00	1	admin	login_success	169.254.169.126	admin	{}
240	2025-04-24 17:03:52.153188+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 17, "comment_id": 6, "project_id": 1, "has_image": false, "event_title": "123312"}
241	2025-04-24 17:07:40.411612+00	1	admin	login_success	169.254.169.126	admin	{}
242	2025-04-25 06:30:40.62119+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
243	2025-04-25 06:30:45.334506+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
244	2025-04-25 06:30:58.27813+00	1	admin	login_success	169.254.169.126	admin	{}
245	2025-04-25 06:31:45.593231+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 9, "comment_id": 7, "project_id": 1, "has_image": true, "event_title": "asdasd"}
246	2025-04-25 06:31:58.01606+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 9, "comment_id": 8, "project_id": 1, "has_image": true, "event_title": "asdasd"}
247	2025-04-25 07:09:27.578978+00	1	admin	login_success	169.254.169.126	admin	{}
248	2025-04-25 07:24:38.085035+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 18, "event_title": "ew", "event_status": "open", "event_state": "periodic check"}
249	2025-04-25 07:41:58.339386+00	1	admin	login_success	169.254.169.126	admin	{}
250	2025-04-25 08:15:54.4106+00	1	admin	login_success	169.254.169.126	admin	{}
251	2025-04-25 08:46:44.739048+00	1	admin	login_success	169.254.169.126	admin	{}
252	2025-04-25 11:06:53.503203+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
253	2025-04-25 11:06:53.87765+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
254	2025-04-25 11:06:53.920665+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
255	2025-04-25 11:17:46.314244+00	1	admin	login_success	169.254.169.126	admin	{}
256	2025-04-25 11:36:37.553294+00	1	admin	login_success	169.254.169.126	admin	{}
257	2025-04-25 12:11:24.362612+00	1	admin	login_success	169.254.169.126	admin	{}
258	2025-04-25 12:54:23.703949+00	1	admin	login_success	169.254.169.126	admin	{}
259	2025-04-25 12:54:36.255827+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "map_name": "1", "map_type": "overlay"}
260	2025-04-25 12:54:36.611478+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 14, "map_name": "2", "map_type": "implantation"}
261	2025-04-25 12:54:37.621925+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 14, "map_name": "2", "map_type": "overlay"}
262	2025-04-25 12:54:37.853935+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "map_name": "1", "map_type": "implantation"}
263	2025-04-25 12:55:07.601324+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 19, "event_title": "adsdasas", "event_status": "open", "event_state": "periodic check"}
264	2025-04-25 12:57:09.473557+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 20, "event_title": "asdasdas", "event_status": "open", "event_state": "periodic check"}
265	2025-04-25 13:30:40.779196+00	1	admin	login_success	169.254.169.126	admin	{}
266	2025-04-25 14:00:34.447205+00	1	admin	login_success	169.254.169.126	admin	{}
267	2025-04-25 14:07:44.243664+00	1	admin	login_success	169.254.169.126	admin	{}
268	2025-04-25 14:24:10.956371+00	1	admin	login_success	169.254.169.126	admin	{}
269	2025-04-25 14:24:10.966954+00	1	admin	login_success	169.254.169.126	admin	{}
270	2025-04-25 14:42:26.768188+00	1	admin	login_success	169.254.169.126	admin	{}
271	2025-04-25 14:43:35.90806+00	1	admin	login_success	169.254.169.126	admin	{}
272	2025-04-25 14:44:14.278098+00	1	admin	login_success	169.254.169.126	admin	{}
273	2025-04-25 15:12:50.64805+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
274	2025-04-25 15:12:50.670326+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
275	2025-04-25 15:44:17.58907+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
276	2025-04-25 15:44:28.567327+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
277	2025-04-25 15:44:36.363504+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
278	2025-04-25 15:45:23.503783+00	1	admin	login_success	169.254.169.126	admin	{}
279	2025-04-25 19:12:02.579444+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
280	2025-04-25 19:12:02.579444+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
281	2025-04-25 19:12:08.494551+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
282	2025-04-25 19:12:10.375454+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
283	2025-04-25 19:12:22.674223+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
284	2025-04-25 19:12:25.334232+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
285	2025-04-25 19:12:32.518365+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
286	2025-04-28 09:58:37.905563+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
287	2025-04-28 09:58:37.911651+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
288	2025-04-28 09:58:43.403428+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
289	2025-04-28 09:58:51.562883+00	1	admin	login_success	169.254.169.126	admin	{}
290	2025-04-28 10:08:17.327349+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
291	2025-04-28 10:08:29.581385+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "resolved", "event_state": "incidence", "status_changed": false, "state_changed": false}
292	2025-04-28 10:08:45.78421+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
293	2025-04-28 10:31:56.571314+00	1	admin	login_success	169.254.169.126	admin	{}
294	2025-04-28 10:32:17.317095+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "resolved", "event_state": "incidence", "status_changed": false, "state_changed": false}
295	2025-04-28 10:32:20.703481+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "open", "event_state": "incidence", "status_changed": false, "state_changed": false}
296	2025-04-28 10:32:24.384842+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
297	2025-04-28 10:32:48.859475+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "resolved", "event_state": "periodic check", "status_changed": false, "state_changed": false}
298	2025-04-28 10:32:51.673352+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "resolved", "event_state": "incidence", "status_changed": false, "state_changed": false}
299	2025-04-28 10:32:53.240196+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
300	2025-04-28 10:32:57.202805+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "resolved", "event_state": "incidence", "status_changed": false, "state_changed": false}
301	2025-04-29 08:19:01.663499+00	1	admin	login_success	169.254.169.126	admin	{}
302	2025-04-29 08:19:01.981465+00	1	admin	login_success	169.254.169.126	admin	{}
303	2025-04-29 08:20:06.736336+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 16, "project_id": 1, "map_id": 13, "event_title": "4214", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
304	2025-04-29 08:20:12.311684+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "open", "event_state": "incidence", "status_changed": false, "state_changed": false}
357	2025-04-29 21:29:12.581364+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
305	2025-04-29 08:20:15.242738+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "resolved", "event_state": "incidence", "status_changed": false, "state_changed": false}
306	2025-04-29 08:20:20.847841+00	1	admin	login_success	169.254.169.126	admin	{}
307	2025-04-29 08:20:30.219184+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 9, "project_id": 1, "map_id": 13, "event_title": "asdasd", "event_status": "closed", "event_state": "periodic check", "status_changed": false, "state_changed": false}
308	2025-04-29 08:20:31.492025+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 9, "project_id": 1, "map_id": 13, "event_title": "asdasd", "event_status": "open", "event_state": "periodic check", "status_changed": false, "state_changed": false}
309	2025-04-29 08:21:59.672241+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 9, "project_id": 1, "map_id": 13, "event_title": "asdasd", "event_status": "closed", "event_state": "periodic check", "status_changed": false, "state_changed": false}
310	2025-04-29 09:42:43.451225+00	1	admin	login_success	169.254.169.126	admin	{}
311	2025-04-29 09:42:43.452241+00	1	admin	login_success	169.254.169.126	admin	{}
312	2025-04-29 09:42:43.654036+00	1	admin	login_success	169.254.169.126	admin	{}
313	2025-04-29 09:42:51.088989+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
314	2025-04-29 09:42:54.106452+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 14, "project_id": 1, "map_id": 13, "event_title": "123123", "event_status": "open", "event_state": "incidence", "status_changed": false, "state_changed": false}
315	2025-04-29 10:15:36.279557+00	1	admin	login_success	169.254.169.126	admin	{}
316	2025-04-29 10:15:36.466254+00	1	admin	login_success	169.254.169.126	admin	{}
317	2025-04-29 10:15:36.472623+00	1	admin	login_success	169.254.169.126	admin	{}
318	2025-04-29 10:37:10.809103+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 15, "comment_id": 9, "project_id": 1, "has_image": true, "event_title": "prueba"}
319	2025-04-29 10:47:24.775782+00	1	admin	login_success	169.254.169.126	admin	{}
320	2025-04-29 10:51:47.508995+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 16, "comment_id": 10, "project_id": 1, "has_image": true, "event_title": "4214"}
321	2025-04-29 11:08:40.168213+00	1	admin	login_success	169.254.169.126	admin	{}
322	2025-04-29 11:21:39.424671+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 2, "map_id": 15, "map_name": "1", "map_type": "overlay"}
323	2025-04-29 11:21:44.349337+00	1	admin	map_update	169.254.169.126	admin	{"project_id": 2, "map_id": 15, "map_name": "1", "map_type": "implantation"}
324	2025-04-29 11:36:34.615977+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 21, "event_title": "aa", "event_status": "open", "event_state": "periodic check"}
325	2025-04-29 11:36:48.794042+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 21, "comment_id": 11, "project_id": 1, "has_image": true, "event_title": "aa"}
326	2025-04-29 11:39:04.139701+00	1	admin	login_success	169.254.169.126	admin	{}
327	2025-04-29 11:41:06.502276+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 17, "comment_id": 12, "project_id": 1, "has_image": true, "event_title": "123312"}
328	2025-04-29 11:42:23.495717+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 6, "map_id": 16, "map_name": "Implantaci\\u00f3n", "map_type": "implantation"}
329	2025-04-29 11:43:53.662696+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 6, "map_id": 16, "event_id": 22, "event_title": "Prueba", "event_status": "resolved", "event_state": "incidence"}
330	2025-04-29 11:44:07.741328+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 22, "comment_id": 13, "project_id": 6, "has_image": false, "event_title": "Prueba"}
331	2025-04-29 11:44:12.900599+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 22, "project_id": 6, "map_id": 16, "event_title": "Prueba", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
332	2025-04-29 11:45:28.215187+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 6, "map_id": 17, "map_name": "pararayos", "map_type": "overlay"}
333	2025-04-29 11:46:27.582121+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 22, "project_id": 6, "map_id": 16, "event_title": "Prueba", "event_status": "resolved", "event_state": "incidence", "status_changed": false, "state_changed": false}
334	2025-04-29 11:46:29.294014+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 22, "project_id": 6, "map_id": 16, "event_title": "Prueba", "event_status": "in-progress", "event_state": "incidence", "status_changed": false, "state_changed": false}
335	2025-04-29 11:46:30.687066+00	1	admin	event_update	169.254.169.126	admin	{"event_id": 22, "project_id": 6, "map_id": 16, "event_title": "Prueba", "event_status": "resolved", "event_state": "incidence", "status_changed": false, "state_changed": false}
336	2025-04-29 14:32:56.58375+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
337	2025-04-29 14:35:40.667151+00	1	admin	login_success	169.254.169.126	admin	{}
338	2025-04-29 14:36:16.348129+00	1	admin	login_success	169.254.169.126	admin	{}
339	2025-04-29 15:11:24.607384+00	1	admin	login_success	169.254.169.126	admin	{}
340	2025-04-29 15:12:45.88239+00	1	admin	login_success	169.254.169.126	admin	{}
341	2025-04-29 15:24:17.381531+00	1	admin	login_success	169.254.169.126	admin	{}
342	2025-04-29 15:50:45.255319+00	1	admin	login_success	169.254.169.126	admin	{}
343	2025-04-29 16:20:25.437628+00	1	admin	login_success	169.254.169.126	admin	{}
344	2025-04-29 16:20:49.613408+00	1	admin	login_success	169.254.169.126	admin	{}
345	2025-04-29 17:04:17.753291+00	1	admin	login_success	169.254.169.126	admin	{}
346	2025-04-29 17:04:34.068484+00	1	admin	login_success	169.254.169.126	admin	{}
347	2025-04-29 18:12:43.30256+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
348	2025-04-29 18:12:43.367231+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
349	2025-04-29 18:12:49.981748+00	1	admin	login_success	169.254.169.126	admin	{}
350	2025-04-29 18:13:05.067211+00	1	admin	login_success	169.254.169.126	admin	{}
351	2025-04-29 18:50:15.872792+00	1	admin	login_success	169.254.169.126	admin	{}
352	2025-04-29 19:21:04.978072+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
353	2025-04-29 19:21:20.062288+00	1	admin	login_success	169.254.169.126	admin	{}
354	2025-04-29 19:21:36.976506+00	1	admin	login_success	169.254.169.126	admin	{}
355	2025-04-29 19:22:45.496055+00	1	admin	login_success	169.254.169.126	admin	{}
356	2025-04-29 19:56:16.177613+00	1	admin	login_success	169.254.169.126	admin	{}
358	2025-04-29 21:29:21.313389+00	1	admin	login_success	169.254.169.126	admin	{}
359	2025-04-29 21:30:05.855538+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 15, "comment_id": 14, "project_id": 1, "has_image": true, "event_title": "prueba"}
360	2025-04-29 21:31:05.866947+00	1	admin	login_success	169.254.169.126	admin	{}
361	2025-04-29 21:31:19.861716+00	1	admin	login_success	169.254.169.126	admin	{}
362	2025-04-30 08:02:00.996003+00	1	admin	login_success	169.254.169.126	admin	{}
363	2025-04-30 08:02:01.060149+00	1	admin	login_success	169.254.169.126	admin	{}
364	2025-04-30 08:02:15.066761+00	1	admin	login_success	169.254.169.126	admin	{}
365	2025-04-30 08:03:05.135201+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 23, "event_title": "hola", "event_status": "open", "event_state": "request"}
366	2025-04-30 08:03:46.57792+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 7, "map_id": 18, "map_name": "aaaa", "map_type": "implantation"}
367	2025-04-30 08:03:55.375054+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 7, "map_id": 18, "event_id": 24, "event_title": "hola", "event_status": "open", "event_state": "incidence"}
368	2025-04-30 08:04:05.566806+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 7, "map_id": 18, "event_id": 25, "event_title": "a", "event_status": "open", "event_state": "periodic check"}
369	2025-04-30 08:05:13.556019+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 16, "comment_id": 15, "project_id": 1, "has_image": true, "event_title": "4214"}
370	2025-04-30 08:24:40.608043+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 6, "map_id": 16, "event_id": 26, "event_title": "1e221", "event_status": "open", "event_state": "periodic check"}
371	2025-04-30 08:25:04.270746+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 6, "map_id": 16, "event_id": 27, "event_title": "qfwewqd", "event_status": "open", "event_state": "request"}
372	2025-04-30 08:39:12.080175+00	1	admin	login_success	169.254.169.126	admin	{}
373	2025-04-30 09:09:51.449959+00	1	admin	login_success	169.254.169.126	admin	{}
374	2025-04-30 09:15:20.848584+00	1	admin	login_success	169.254.169.126	admin	{}
375	2025-04-30 09:58:33.828288+00	1	admin	login_success	169.254.169.126	admin	{}
376	2025-04-30 09:59:01.071135+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 6, "map_id": 16, "event_id": 28, "event_title": "hey", "event_status": "open", "event_state": "periodic check"}
377	2025-04-30 09:59:17.626051+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 29, "event_title": "1", "event_status": "open", "event_state": "periodic check"}
378	2025-04-30 09:59:43.294443+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 7, "map_id": 18, "event_id": 30, "event_title": "asdasdasd", "event_status": "open", "event_state": "periodic check"}
379	2025-04-30 10:00:01.770995+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 28, "comment_id": 16, "project_id": 6, "has_image": true, "event_title": "hey"}
380	2025-04-30 10:00:37.882071+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 8, "map_id": 19, "map_name": "prueba", "map_type": "implantation"}
381	2025-04-30 10:00:46.512793+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 8, "map_id": 19, "event_id": 31, "event_title": "evento", "event_status": "open", "event_state": "periodic check"}
382	2025-04-30 10:01:02.66108+00	1	admin	login_success	169.254.169.126	admin	{}
383	2025-04-30 11:03:09.748948+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
384	2025-04-30 11:03:09.993104+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
385	2025-04-30 11:03:15.187223+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
386	2025-04-30 11:03:24.262253+00	1	admin	login_success	169.254.169.126	admin	{}
387	2025-04-30 11:09:49.862063+00	1	admin	login_success	169.254.169.126	admin	{}
388	2025-04-30 11:10:11.673005+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 32, "event_title": "asdasdads", "event_status": "open", "event_state": "periodic check"}
389	2025-04-30 11:10:18.947524+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 33, "event_title": "asddasadsa", "event_status": "open", "event_state": "periodic check"}
390	2025-04-30 11:11:23.002535+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 6, "map_id": 16, "event_id": 34, "event_title": "assadads", "event_status": "open", "event_state": "periodic check"}
391	2025-04-30 11:16:09.653476+00	1	admin	login_success	169.254.169.126	admin	{}
392	2025-04-30 11:17:01.801519+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 35, "event_title": "123132", "event_status": "open", "event_state": "periodic check"}
393	2025-04-30 12:55:53.886926+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
394	2025-04-30 12:55:55.104772+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
395	2025-04-30 12:56:02.050315+00	1	admin	login_success	169.254.169.126	admin	{}
396	2025-04-30 12:56:16.70884+00	1	admin	login_success	169.254.169.126	admin	{}
397	2025-04-30 15:27:04.870713+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
398	2025-04-30 15:27:08.460946+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
399	2025-04-30 15:27:19.003985+00	1	admin	login_success	169.254.169.126	admin	{}
400	2025-04-30 15:27:33.534217+00	1	admin	login_success	169.254.169.126	admin	{}
401	2025-04-30 16:51:19.343299+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
402	2025-04-30 16:51:19.381998+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
403	2025-04-30 16:51:19.404759+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
404	2025-04-30 16:51:19.885742+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
405	2025-04-30 16:51:23.034089+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
406	2025-04-30 16:51:33.581149+00	1	admin	login_success	169.254.169.126	admin	{}
407	2025-04-30 16:51:47.310168+00	1	admin	login_success	169.254.169.126	admin	{}
408	2025-04-30 17:22:36.299669+00	1	admin	login_success	169.254.169.126	admin	{}
409	2025-04-30 17:45:38.294724+00	1	admin	login_success	169.254.169.126	admin	{}
410	2025-04-30 18:07:52.602456+00	1	admin	login_success	169.254.169.126	admin	{}
411	2025-05-05 14:18:21.107669+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
412	2025-05-05 14:18:38.67732+00	1	admin	login_success	169.254.169.126	admin	{}
413	2025-05-05 14:18:55.454986+00	1	admin	login_success	169.254.169.126	admin	{}
414	2025-05-05 14:25:37.216235+00	1	admin	login_success	169.254.169.126	admin	{}
415	2025-05-06 07:29:45.562975+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
416	2025-05-06 07:29:45.564738+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
419	2025-05-06 07:31:31.247283+00	1	admin	login_success	169.254.169.126	admin	{}
420	2025-05-06 07:32:41.193199+00	1	admin	login_success	169.254.169.126	admin	{}
421	2025-05-06 08:09:52.986666+00	1	admin	login_success	169.254.169.126	admin	{}
422	2025-05-06 08:10:08.430483+00	1	admin	login_success	169.254.169.126	admin	{}
423	2025-05-06 08:10:28.278554+00	1	admin	login_success	169.254.169.126	admin	{}
424	2025-05-06 08:26:34.64654+00	1	admin	login_success	169.254.169.126	admin	{}
425	2025-05-06 09:14:04.385137+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
426	2025-05-06 09:14:04.402237+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
427	2025-05-06 09:14:05.942362+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
428	2025-05-06 09:14:08.88545+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
429	2025-05-06 09:14:13.393254+00	1	admin	login_success	169.254.169.126	admin	{}
430	2025-05-06 09:14:41.062442+00	1	admin	login_success	169.254.169.126	admin	{}
431	2025-05-06 09:17:33.8063+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 9, "map_id": 20, "map_name": "1", "map_type": "implantation"}
432	2025-05-06 09:18:09.180609+00	1	admin	login_success	169.254.169.126	admin	{}
433	2025-05-06 09:31:15.476316+00	1	admin	login_success	169.254.169.126	admin	{}
434	2025-05-06 09:35:20.08118+00	1	admin	login_success	169.254.169.126	admin	{}
435	2025-05-06 09:49:43.848245+00	1	admin	login_success	169.254.169.126	admin	{}
436	2025-05-06 09:51:25.97734+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 36, "event_title": "hola", "event_status": "open", "event_state": "incidence"}
437	2025-05-06 10:03:48.045719+00	1	admin	event_comment_create	169.254.169.126	admin	{"event_id": 16, "comment_id": 17, "project_id": 1, "has_image": true, "event_title": "4214"}
438	2025-05-06 10:05:38.221579+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 37, "event_title": "prueba", "event_status": "open", "event_state": "incidence"}
439	2025-05-06 10:08:18.944341+00	1	admin	login_success	169.254.169.126	admin	{}
440	2025-05-06 10:24:22.579194+00	1	admin	login_success	169.254.169.126	admin	{}
441	2025-05-06 10:38:24.485846+00	1	admin	login_success	169.254.169.126	admin	{}
442	2025-05-06 11:06:58.703463+00	1	admin	login_success	169.254.169.126	admin	{}
443	2025-05-06 11:07:21.966265+00	1	admin	login_success	169.254.169.126	admin	{}
444	2025-05-06 11:29:25.244292+00	1	admin	login_success	169.254.169.126	admin	{}
445	2025-05-06 11:46:56.145112+00	1	admin	login_success	169.254.169.126	admin	{}
446	2025-05-06 12:03:06.469695+00	1	admin	login_success	169.254.169.126	admin	{}
447	2025-05-06 12:03:06.470358+00	1	admin	login_success	169.254.169.126	admin	{}
448	2025-05-06 12:43:18.560954+00	1	admin	login_success	169.254.169.126	admin	{}
449	2025-05-06 12:43:18.588488+00	1	admin	login_success	169.254.169.126	admin	{}
450	2025-05-06 12:46:02.602246+00	1	admin	login_success	169.254.169.126	admin	{}
451	2025-05-06 12:54:31.844569+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 1, "map_id": 13, "event_id": 38, "event_title": "Hi", "event_status": "open", "event_state": "periodic check"}
452	2025-05-06 12:55:59.006354+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 10, "map_id": 21, "map_name": "1", "map_type": "implantation"}
453	2025-05-06 12:56:17.621758+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 10, "map_id": 21, "event_id": 39, "event_title": "Plus button", "event_status": "open", "event_state": "periodic check"}
454	2025-05-06 12:57:07.426567+00	1	admin	map_upload	169.254.169.126	admin	{"project_id": 11, "map_id": 22, "map_name": "1", "map_type": "implantation"}
455	2025-05-06 12:57:39.829327+00	1	admin	event_create	169.254.169.126	admin	{"project_id": 11, "map_id": 22, "event_id": 40, "event_title": "Hi", "event_status": "open", "event_state": "periodic check"}
456	2025-05-06 13:13:29.779223+00	1	admin	login_success	169.254.169.126	admin	{}
457	2025-05-06 13:14:17.595084+00	1	admin	login_success	169.254.169.126	admin	{}
417	2025-05-06 07:29:45.562509+00	\N	admin	login_failed	169.254.169.126	unknown	{"reason": "Incorrect username or password"}
418	2025-05-06 07:30:22.348293+00	1	admin	login_success	169.254.169.126	admin	{}
\.


--
-- Data for Name: user_preference; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_preference (id, user_id, theme, notification_email, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_preferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_preferences (id, user_id, email_notifications) FROM stdin;
1	1	t
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password_hash, is_admin, is_active, created_at) FROM stdin;
1	admin	seritec.ingenieria.rd@gmail.com	$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By 	t	t	2025-04-16 09:27:35.343898
\.


--
-- Name: event_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.event_comments_id_seq', 17, true);


--
-- Name: event_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.event_history_id_seq', 64, true);


--
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.events_id_seq', 40, true);


--
-- Name: maps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.maps_id_seq', 22, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 3, true);


--
-- Name: project_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_user_id_seq', 1, false);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_id_seq', 11, true);


--
-- Name: user_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_activities_id_seq', 457, true);


--
-- Name: user_preference_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_preference_id_seq', 1, false);


--
-- Name: user_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_preferences_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: event_comments event_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_comments
    ADD CONSTRAINT event_comments_pkey PRIMARY KEY (id);


--
-- Name: event_history event_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_history
    ADD CONSTRAINT event_history_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: maps maps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maps
    ADD CONSTRAINT maps_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: project_user project_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_user
    ADD CONSTRAINT project_user_pkey PRIMARY KEY (id);


--
-- Name: project_user project_user_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_user
    ADD CONSTRAINT project_user_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_users project_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_users
    ADD CONSTRAINT project_users_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: user_activities user_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_pkey PRIMARY KEY (id);


--
-- Name: user_preference user_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_pkey PRIMARY KEY (id);


--
-- Name: user_preference user_preference_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_user_id_key UNIQUE (user_id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: ix_event_comments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_event_comments_id ON public.event_comments USING btree (id);


--
-- Name: ix_user_activities_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_activities_action ON public.user_activities USING btree (action);


--
-- Name: ix_user_activities_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_activities_id ON public.user_activities USING btree (id);


--
-- Name: ix_user_activities_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_activities_timestamp ON public.user_activities USING btree ("timestamp");


--
-- Name: ix_user_activities_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_activities_user_id ON public.user_activities USING btree (user_id);


--
-- Name: ix_user_activities_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_activities_user_type ON public.user_activities USING btree (user_type);


--
-- Name: ix_user_activities_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_activities_username ON public.user_activities USING btree (username);


--
-- Name: events event_sync_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER event_sync_trigger BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.sync_event_name_title();


--
-- Name: event_comments event_comments_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_comments
    ADD CONSTRAINT event_comments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_comments event_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_comments
    ADD CONSTRAINT event_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: event_history event_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_history
    ADD CONSTRAINT event_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: event_history event_history_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_history
    ADD CONSTRAINT event_history_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: events events_map_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_map_id_fkey FOREIGN KEY (map_id) REFERENCES public.maps(id) ON DELETE CASCADE;


--
-- Name: maps maps_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maps
    ADD CONSTRAINT maps_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: maps maps_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maps
    ADD CONSTRAINT maps_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_user project_user_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_user
    ADD CONSTRAINT project_user_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_user project_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_user
    ADD CONSTRAINT project_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_users project_users_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_users
    ADD CONSTRAINT project_users_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_users project_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_users
    ADD CONSTRAINT project_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: user_activities user_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_preference user_preference_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preference
    ADD CONSTRAINT user_preference_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT ALL ON SCHEMA public TO cloudsqlsuperuser;


--
-- Name: TABLE event_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_comments TO PUBLIC;
GRANT ALL ON TABLE public.event_comments TO "map-sa";


--
-- Name: SEQUENCE event_comments_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.event_comments_id_seq TO PUBLIC;


--
-- Name: TABLE event_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_history TO "map-sa";
GRANT ALL ON TABLE public.event_history TO PUBLIC;


--
-- Name: SEQUENCE event_history_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.event_history_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.event_history_id_seq TO PUBLIC;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO "map-sa";
GRANT ALL ON TABLE public.events TO PUBLIC;


--
-- Name: SEQUENCE events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.events_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.events_id_seq TO PUBLIC;


--
-- Name: TABLE maps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.maps TO "map-sa";
GRANT ALL ON TABLE public.maps TO PUBLIC;


--
-- Name: SEQUENCE maps_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.maps_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.maps_id_seq TO PUBLIC;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO "map-sa";
GRANT ALL ON TABLE public.notifications TO PUBLIC;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.notifications_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.notifications_id_seq TO PUBLIC;


--
-- Name: TABLE project_user; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_user TO "map-sa";
GRANT ALL ON TABLE public.project_user TO PUBLIC;


--
-- Name: SEQUENCE project_user_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.project_user_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.project_user_id_seq TO PUBLIC;


--
-- Name: TABLE project_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_users TO PUBLIC;
GRANT ALL ON TABLE public.project_users TO "map-sa";


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.projects TO "map-sa";
GRANT ALL ON TABLE public.projects TO PUBLIC;


--
-- Name: SEQUENCE projects_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.projects_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.projects_id_seq TO PUBLIC;


--
-- Name: TABLE user_activities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_activities TO PUBLIC;
GRANT ALL ON TABLE public.user_activities TO "map-sa";


--
-- Name: SEQUENCE user_activities_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_activities_id_seq TO PUBLIC;


--
-- Name: TABLE user_preference; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_preference TO "map-sa";
GRANT ALL ON TABLE public.user_preference TO PUBLIC;


--
-- Name: SEQUENCE user_preference_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_preference_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.user_preference_id_seq TO PUBLIC;


--
-- Name: TABLE user_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_preferences TO PUBLIC;


--
-- Name: SEQUENCE user_preferences_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_preferences_id_seq TO PUBLIC;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.users TO "map-sa";
GRANT ALL ON TABLE public.users TO PUBLIC;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.users_id_seq TO "map-sa";
GRANT ALL ON SEQUENCE public.users_id_seq TO PUBLIC;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "map-sa" IN SCHEMA public GRANT ALL ON SEQUENCES  TO PUBLIC;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE mapuser IN SCHEMA public GRANT ALL ON SEQUENCES  TO PUBLIC;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE mapuser IN SCHEMA public GRANT ALL ON TABLES  TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE mapuser IN SCHEMA public GRANT ALL ON TABLES  TO "map-sa";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "map-sa" IN SCHEMA public GRANT ALL ON TABLES  TO PUBLIC;


--
-- PostgreSQL database dump complete
--

