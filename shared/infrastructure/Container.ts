import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { PrismaWorkshopRepository } from '@/modules/workshop/infrastructure/PrismaWorkshopRepository'
import { CachedWorkshopRepository } from '@/modules/workshop/infrastructure/CachedWorkshopRepository'
import type { IPaymentGateway } from '@/modules/payment/domain/IPaymentGateway'
import { VNPayGateway } from '@/modules/payment/infrastructure/VNPayGateway'
import { PaymentGatewayCircuitBreaker } from '@/modules/payment/infrastructure/PaymentGatewayCircuitBreaker'
import { db } from './PrismaClient'
import { redis } from './RedisClient'
import '@/bootstrap'

type Factory<T> = () => T;

const registry = new Map<string, Factory<unknown>>();
const singletons = new Map<string, unknown>();

export const Container = {
  register<T>(token: string, factory: Factory<T>): void {
    registry.set(token, factory as Factory<unknown>);
  },

  resolve<T>(token: string): T {
    if (singletons.has(token)) {
      return singletons.get(token) as T;
    }
    const factory = registry.get(token);
    if (!factory) {
      throw new Error(`[Container] No registration found for token: ${token}`);
    }
    const instance = factory() as T;
    singletons.set(token, instance);
    return instance;
  },

  reset(): void {
    singletons.clear();
  },
};

Container.register<IWorkshopRepository>(
  'workshopRepository',
  () => new CachedWorkshopRepository(new PrismaWorkshopRepository(db), redis)
);

Container.register<IPaymentGateway>(
  'paymentGateway',
  () => new PaymentGatewayCircuitBreaker(
    new VNPayGateway({
      tmnCode:    process.env.VNPAY_TMN_CODE!,
      hashSecret: process.env.VNPAY_HASH_SECRET!,
      paymentUrl: process.env.VNPAY_URL!,
      queryUrl:   process.env.VNPAY_QUERY_URL!,
    }),
    redis,
  )
);
