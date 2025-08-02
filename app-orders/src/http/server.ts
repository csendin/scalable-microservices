import '@opentelemetry/auto-instrumentations-node/register'

import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'

import { trace } from '@opentelemetry/api'

import { fastify } from 'fastify'
import { fastifyCors } from '@fastify/cors'
import { z } from 'zod'
import {
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import { db } from '../db/client.ts'
import { schema } from '../db/schema/index.ts'
import { dispatchOrderCreated } from '../broker/messages/order-created.ts'
import { tracer } from '../tracer/tracer.ts'

const app = fastify().withTypeProvider<ZodTypeProvider>()

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

app.register(fastifyCors, { origin: '*' })

app.get('/health', () => {
    return 'OK'
})

app.post('/orders', {
    schema: {
        body: z.object({
            amount: z.coerce.number(),
        })
    }
}, async (request, reply) => {
    const { amount } = request.body

    console.log('Creating an order with amount', amount)

    const orderId = randomUUID()

    await db.insert(schema.orders).values({
        id: orderId,
        customerId: '1f6766c2-ca49-44c0-ae2f-61c360cf1406',
        amount,
    })

    const span = tracer.startSpan('I think things are going wrong here')

    span.setAttribute('test', 'Hello World')

    await setTimeout(2000)

    span.end()

    trace.getActiveSpan()?.setAttribute('order_id', orderId)

    dispatchOrderCreated({
        orderId,
        amount,
        customer: {
            id: '1f6766c2-ca49-44c0-ae2f-61c360cf1406'
        },
    })

    return reply.status(201).send()
})

app.listen({ host: '0.0.0.0', port: 3333 }).then(() => {
    console.log('[Orders] HTTP server running!')
})
