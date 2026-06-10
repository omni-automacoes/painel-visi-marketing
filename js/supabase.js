/**
 * supabase.js — Configuração e cliente único do Supabase
 *
 * Importe o cliente em qualquer módulo do projeto:
 *   import { supabase } from './supabase.js';
 *   import { supabase } from '../js/supabase.js';
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─── Credenciais do Projeto ────────────────────────────────────────────────
const SUPABASE_URL  = 'https://mnoknmzkmqbkbyobjzuh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ub2tubXprbXFia2J5b2JqenVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTIyOTIsImV4cCI6MjA5MTU4ODI5Mn0.TVWh8Dr5Y-4AKjLxL-8Hcs-GocgAXLBjBDPzdALgAM8';

// ─── Instância única (singleton) ──────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
