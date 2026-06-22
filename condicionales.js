/**
 * Caso real: Transferencia bancaria
 * Validación de una operación usando únicamente condicionales (if, else if, else)
 */

const cuentaOrigen = {
  titular: "María López",
  numero: "001-456789",
  saldo: 2500.0,
  activa: true,
  bloqueada: false,
  limiteDiario: 3000,
  montoTransferidoHoy: 500,
};

const cuentaDestino = {
  titular: "Carlos Ruiz",
  numero: "002-987654",
  activa: true,
};

const transferencia = {
  monto: 800,
  moneda: "PEN",
  hora: 14,
  codigoSeguridadIngresado: "4829",
  codigoSeguridadCorrecto: "4829",
};

function procesarTransferencia(origen, destino, datos) {
  let mensaje = "";

  // 1. Verificar si la cuenta de origen está activa
  if (!origen.activa) {
    mensaje = "Transferencia rechazada: la cuenta de origen no está activa.";
  }
  // 2. Verificar si la cuenta de origen está bloqueada
  else if (origen.bloqueada) {
    mensaje = "Transferencia rechazada: la cuenta de origen está bloqueada.";
  }
  // 3. Verificar si la cuenta destino está activa
  else if (!destino.activa) {
    mensaje = "Transferencia rechazada: la cuenta destino no está disponible.";
  }
  // 4. Verificar que no se transfiera a la misma cuenta
  else if (origen.numero === destino.numero) {
    mensaje = "Transferencia rechazada: no puedes transferir a la misma cuenta.";
  }
  // 5. Verificar monto mínimo permitido
  else if (datos.monto <= 0) {
    mensaje = "Transferencia rechazada: el monto debe ser mayor a S/ 0.00.";
  }
  // 6. Verificar monto mínimo del banco (S/ 1.00)
  else if (datos.monto < 1) {
    mensaje = "Transferencia rechazada: el monto mínimo de transferencia es S/ 1.00.";
  }
  // 7. Verificar saldo suficiente
  else if (datos.monto > origen.saldo) {
    mensaje =
      "Transferencia rechazada: saldo insuficiente. Saldo disponible: S/ " +
      origen.saldo.toFixed(2);
  }
  // 8. Verificar límite diario de transferencias
  else if (origen.montoTransferidoHoy + datos.monto > origen.limiteDiario) {
    const disponible = origen.limiteDiario - origen.montoTransferidoHoy;
    mensaje =
      "Transferencia rechazada: supera el límite diario. Puedes transferir hasta S/ " +
      disponible.toFixed(2) +
      " más hoy.";
  }
  // 9. Verificar horario bancario (8:00 a 18:00)
  else if (datos.hora < 8 || datos.hora >= 18) {
    if (datos.monto > 500) {
      mensaje =
        "Transferencia rechazada: fuera de horario solo se permiten montos hasta S/ 500.00.";
    } else {
      mensaje =
        "Transferencia programada: se procesará el siguiente día hábil (fuera de horario).";
    }
  }
  // 10. Verificar código de seguridad para montos mayores a S/ 500
  else if (datos.monto > 500) {
    if (datos.codigoSeguridadIngresado !== datos.codigoSeguridadCorrecto) {
      mensaje =
        "Transferencia rechazada: código de seguridad incorrecto.";
    } else if (datos.moneda !== "PEN") {
      mensaje =
        "Transferencia rechazada: solo se aceptan transferencias en soles (PEN).";
    } else {
      mensaje =
        "Transferencia aprobada: S/ " +
        datos.monto.toFixed(2) +
        " enviados a " +
        destino.titular +
        " (" +
        destino.numero +
        ").";
    }
  }
  // 11. Transferencias menores o iguales a S/ 500 (sin código extra)
  else {
    if (datos.moneda !== "PEN") {
      mensaje =
        "Transferencia rechazada: solo se aceptan transferencias en soles (PEN).";
    } else {
      mensaje =
        "Transferencia aprobada: S/ " +
        datos.monto.toFixed(2) +
        " enviados a " +
        destino.titular +
        " (" +
        destino.numero +
        ").";
    }
  }

  return mensaje;
}

const resultado = procesarTransferencia(
  cuentaOrigen,
  cuentaDestino,
  transferencia
);

console.log("=== TRANSFERENCIA BANCARIA ===");
console.log("Titular origen:", cuentaOrigen.titular);
console.log("Titular destino:", cuentaDestino.titular);
console.log("Monto:", "S/ " + transferencia.monto.toFixed(2));
console.log("Resultado:", resultado);
