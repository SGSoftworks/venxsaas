-- Ensure invoices storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', true, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read from invoices bucket
CREATE POLICY "public_read_invoices" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'invoices');

-- Allow superadmins to upload to invoices bucket
CREATE POLICY "superadmin_upload_invoices" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'invoices'
        AND EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );
