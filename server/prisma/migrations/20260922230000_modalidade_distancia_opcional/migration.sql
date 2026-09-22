-- Torna distanciaKm opcional para percursos livres ou eventos de desafio
ALTER TABLE "Modalidade" ALTER COLUMN "distanciaKm" DROP NOT NULL;
