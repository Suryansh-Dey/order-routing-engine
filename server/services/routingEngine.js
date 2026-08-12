const RoutingConfig = require('../models/RoutingConfig');

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function getSeededDeliveryDays(seedString) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = Math.imul(31, hash) + seedString.charCodeAt(i) | 0;
  }
  const positiveHash = Math.abs(hash);
  return (positiveHash % 7) + 1; // Returns 1 to 7 days
}

exports.selectBestWarehouse = async (inventories, quantity, customerLat, customerLng, productName = 'Product') => {
  let bestScore = -1;
  let selectedWarehouse = null;
  let selectedInventory = null;
  const allScores = [];
  const eliminatedWarehouses = [];

  let config = await RoutingConfig.findOne();
  if (!config) {
    config = new RoutingConfig();
  }

  const wDist = config.distanceWeight / 100;
  const wInv = config.inventoryWeight / 100;
  const wDel = config.deliveryWeight / 100;
  const wCost = config.costWeight / 100;

  const eligibleInventories = [];

  for (const inv of inventories) {
    const warehouse = inv.warehouseId;
    if (!warehouse) continue;

    if (warehouse.activeStatus !== true || inv.availableQuantity < quantity) {
      eliminatedWarehouses.push({
        warehouseName: warehouse.warehouseName,
        availableQuantity: inv.availableQuantity,
        reason: warehouse.activeStatus !== true ? 'Inactive' : 'Insufficient stock'
      });
      continue;
    }

    eligibleInventories.push(inv);
  }

  if (eligibleInventories.length === 0) {
    return {
      selectedWarehouse: null,
      finalScore: 0,
      allScores: [],
      eliminatedWarehouses,
      selectedInventory: null,
      weights: {
        distanceWeight: config.distanceWeight,
        inventoryWeight: config.inventoryWeight,
        deliveryWeight: config.deliveryWeight,
        costWeight: config.costWeight
      }
    };
  }

  const rawScores = [];
  let minRawDist = Infinity, maxRawDist = -Infinity;
  let minRawInv = Infinity, maxRawInv = -Infinity;
  let minRawDel = Infinity, maxRawDel = -Infinity;
  let minRawCost = Infinity, maxRawCost = -Infinity;

  for (const inv of eligibleInventories) {
    const warehouse = inv.warehouseId;
    const distance_km = getDistanceFromLatLonInKm(customerLat, customerLng, warehouse.latitude, warehouse.longitude);

    // Raw Scores
    const rawDistScore = 1 / (1 + distance_km);
    
    const totalInventory = inv.availableQuantity + inv.reservedQuantity;
    const rawInvScore = totalInventory > 0 ? (inv.availableQuantity / totalInventory) : 0;
    
    const delivery_days = getSeededDeliveryDays(productName + warehouse.warehouseName);
    const rawDelScore = 1 / delivery_days;
    
    const cost = distance_km * 5;
    const rawCostScore = 1 / (1 + cost);

    // Min/Max tracking
    minRawDist = Math.min(minRawDist, rawDistScore);
    maxRawDist = Math.max(maxRawDist, rawDistScore);
    minRawInv = Math.min(minRawInv, rawInvScore);
    maxRawInv = Math.max(maxRawInv, rawInvScore);
    minRawDel = Math.min(minRawDel, rawDelScore);
    maxRawDel = Math.max(maxRawDel, rawDelScore);
    minRawCost = Math.min(minRawCost, rawCostScore);
    maxRawCost = Math.max(maxRawCost, rawCostScore);

    rawScores.push({ warehouse, inv, distance_km, delivery_days, cost, rawDistScore, rawInvScore, rawDelScore, rawCostScore });
  }

  for (const item of rawScores) {
    const { warehouse, inv, distance_km, delivery_days, cost, rawDistScore, rawInvScore, rawDelScore, rawCostScore } = item;

    // Min-Max Scaling (if min == max, all warehouses score 1 for this metric)
    const distScore = maxRawDist === minRawDist ? 1 : (rawDistScore - minRawDist) / (maxRawDist - minRawDist);
    const invScore = maxRawInv === minRawInv ? 1 : (rawInvScore - minRawInv) / (maxRawInv - minRawInv);
    const delScore = maxRawDel === minRawDel ? 1 : (rawDelScore - minRawDel) / (maxRawDel - minRawDel);
    const costScore = maxRawCost === minRawCost ? 1 : (rawCostScore - minRawCost) / (maxRawCost - minRawCost);

    // Final Score
    const finalScore = (wDist * distScore) + (wInv * invScore) + (wDel * delScore) + (wCost * costScore);
    
    allScores.push({
      warehouseName: warehouse.warehouseName,
      distance_km,
      delivery_days,
      cost,
      distScore,
      invScore,
      delScore,
      costScore,
      distWeighted: wDist * distScore,
      invWeighted: wInv * invScore,
      delWeighted: wDel * delScore,
      costWeighted: wCost * costScore,
      finalScore,
      inventory: inv.availableQuantity
    });

    if (finalScore > bestScore) {
      bestScore = finalScore;
      selectedWarehouse = warehouse;
      selectedInventory = inv;
    }
  }

  return {
    selectedWarehouse,
    finalScore: bestScore,
    allScores,
    eliminatedWarehouses,
    selectedInventory,
    weights: {
      distanceWeight: config.distanceWeight,
      inventoryWeight: config.inventoryWeight,
      deliveryWeight: config.deliveryWeight,
      costWeight: config.costWeight
    }
  };
};
