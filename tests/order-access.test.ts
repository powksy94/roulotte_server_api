import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildTestApp } from './helpers/test-app.js'; // Votre app montée avec les repos mémoire
import { hashPassword } from '../src/fourni/auth/index.js';

describe('Contrôle d’accès Auth & Commandes (GET /orders)', () => {
  let app: Express;
  let tokenClientA: string;
  let tokenClientB: string;
  let tokenStaff: string;
  let orderIdClientA: number;

  beforeEach(async () => {
    const context = await buildTestApp();
    app = context.app;

    // 1. Inscription et connexion Client A
    await request(app).post('/auth/register').send({
      email: 'clienta@test.fr',
      name: 'Client A',
      password: 'Password123!',
    });
    const loginA = await request(app).post('/auth/login').send({
      email: 'clienta@test.fr',
      password: 'Password123!',
    });
    tokenClientA = loginA.body.token;

    // 2. Inscription et connexion Client B
    await request(app).post('/auth/register').send({
      email: 'clientb@test.fr',
      name: 'Client B',
      password: 'Password123!',
    });
    const loginB = await request(app).post('/auth/login').send({
      email: 'clientb@test.fr',
      password: 'Password123!',
    });
    tokenClientB = loginB.body.token;

    // 3. Création d'un compte STAFF via le repo mémoire et connexion
    await context.users.create({
      email: 'chef@roulotte.fr',
      name: 'Chef Cuisine',
      role: 'STAFF',
      passwordHash: await hashPassword('Chef1234!'),
    });
    const loginStaff = await request(app).post('/auth/login').send({
      email: 'chef@roulotte.fr',
      password: 'Chef1234!',
    });
    tokenStaff = loginStaff.body.token;

    // 4. Insertion d'une commande appartenant au Client A dans le repo mémoire
    const createdOrder = await context.orders.seed({
      customerId: loginA.body.user.id,
      status: 'RECEIVED',
      totalCents: 1500,
    });
    orderIdClientA = createdOrder.id;
  });

  it('refuse l’accès non authentifié avec un code 401', async () => {
    const res = await request(app).get('/orders');
    expect(res.status).toBe(401);
  });

  it('permet à un client de voir uniquement ses propres commandes dans GET /orders', async () => {
    const resA = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${tokenClientA}`);
    expect(resA.status).toBe(200);
    expect(resA.body.items).toHaveLength(1);

    const resB = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${tokenClientB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.items).toHaveLength(0); // Client B ne voit pas la commande de A
  });

  it('renvoie 404 (et non 403) si un client tente de lire la commande d’un autre client', async () => {
    const res = await request(app)
      .get(`/orders/${orderIdClientA}`)
      .set('Authorization', `Bearer ${tokenClientB}`);

    expect(res.status).toBe(404);
  });

  it('permet à un membre STAFF de voir toutes les commandes et le détail de n’importe laquelle', async () => {
    const listRes = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${tokenStaff}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(1);

    const detailRes = await request(app)
      .get(`/orders/${orderIdClientA}`)
      .set('Authorization', `Bearer ${tokenStaff}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(orderIdClientA);
  });
});