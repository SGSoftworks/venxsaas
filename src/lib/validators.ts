import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})

export const registerSchema = z.object({
  nombre_negocio: z.string().min(3, 'Mínimo 3 caracteres').max(100),
  nit: z.string().min(4, 'NIT requerido').max(20),
  email_propietario: z.string().email('Correo inválido'),
  telefono: z.string().min(7, 'Teléfono requerido').max(15),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string(),
  plan_id: z.string().uuid('Plan requerido'),
  acepta_terminos: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar los términos' }) }),
}).refine(d => d.password === d.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
})

export type LoginForm = z.infer<typeof loginSchema>
export type RegisterForm = z.infer<typeof registerSchema>
