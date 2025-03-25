'use server'

export async function getTravels() {
    return await prisma.travel.findMany();//TODO: add filters
}