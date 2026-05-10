import type { Registration } from './Registration'

export interface IRegistrationRepository {
  findById(id: string): Promise<Registration | null>
  findByUserAndWorkshop(userId: string, workshopId: string): Promise<Registration | null>
  listByUser(userId: string): Promise<Registration[]>
  listByWorkshop(workshopId: string): Promise<Registration[]>
  create(registration: Registration): Promise<Registration>
  update(registration: Registration): Promise<Registration>
}
