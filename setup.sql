-- ============================================
-- Student Record Management System
-- Supabase SQL Setup Script
-- ============================================
-- Run this in your Supabase SQL Editor:
-- https://app.supabase.com → Your Project → SQL Editor
-- ============================================

-- Create the students table
CREATE TABLE IF NOT EXISTS students (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    program TEXT NOT NULL,
    year_level INTEGER NOT NULL CHECK (year_level BETWEEN 1 AND 6),
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for anonymous users (public access)
CREATE POLICY "Allow public read access"
    ON students FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow public insert access"
    ON students FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow public update access"
    ON students FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete access"
    ON students FOR DELETE
    TO anon
    USING (true);
