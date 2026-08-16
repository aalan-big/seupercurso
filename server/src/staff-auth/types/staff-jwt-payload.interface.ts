export interface StaffJwtPayload {
  sub: string;
  email: string;
  organizadorId: string;
  tipo: 'staff';
}
