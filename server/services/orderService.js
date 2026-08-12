const RoutingHistory = require('../models/RoutingHistory');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const routingEngine = require('./routingEngine');
const aiExplanation = require('./aiExplanation');

exports.processAndRouteOrder = async ({ customerLat, customerLng, productId, quantity, customerName }) => {
  if (!customerLat || !customerLng || !productId || !quantity) {
    throw new Error('Missing required fields');
  }

  // Step 1: Query inventory
  const inventories = await Inventory.find({ productId }).populate('warehouseId');
  const product = await Product.findById(productId);
  const productName = product ? product.productName : 'Product';
  
  // Step 2 & 3: Score and select warehouse
  const { selectedWarehouse, finalScore, allScores, eliminatedWarehouses, selectedInventory, weights } = await routingEngine.selectBestWarehouse(
    inventories,
    quantity,
    customerLat,
    customerLng,
    productName
  );

  if (!selectedWarehouse) {
    return {
      success: false,
      message: 'No eligible warehouses with sufficient stock found',
      data: { eliminatedWarehouses, weights }
    };
  }

  // Step 4: Reserve inventory
  selectedInventory.availableQuantity -= quantity;
  selectedInventory.reservedQuantity += quantity;
  await selectedInventory.save();

  // Create Order (status is assigned by default in schema)
  const newOrder = new Order({
    customerName: customerName || 'Guest',
    customerLatitude: customerLat,
    customerLongitude: customerLng,
    productId,
    quantity,
    assignedWarehouseId: selectedWarehouse._id,
    status: 'assigned'
  });
  await newOrder.save();

  // Step 5: Call AI Explanation
  const selectedScoreData = allScores.find(s => s.warehouseName === selectedWarehouse.warehouseName);
  const rejectedScores = allScores.filter(s => s.warehouseName !== selectedWarehouse.warehouseName);

  const aiExplanationText = await aiExplanation.generateExplanation({
    productName,
    selectedWarehouse: selectedWarehouse.warehouseName,
    distance: selectedScoreData.distance_km,
    inventory: selectedScoreData.inventory,
    deliveryDays: selectedScoreData.delivery_days,
    cost: selectedScoreData.cost,
    finalScore,
    distScore: selectedScoreData.distScore,
    invScore: selectedScoreData.invScore,
    delScore: selectedScoreData.delScore,
    costScore: selectedScoreData.costScore,
    weights,
    rejectedWarehouses: rejectedScores
  });

  // Step 6: Save to Routing History
  const routingHistory = new RoutingHistory({
    orderId: newOrder._id,
    warehouseId: selectedWarehouse._id,
    routingScore: finalScore,
    routingReason: aiExplanationText,
    allScores,
    eliminatedWarehouses,
    weights
  });
  await routingHistory.save();

  return {
    success: true,
    data: {
      order: newOrder,
      selectedWarehouse,
      routingScore: finalScore,
      routingReason: aiExplanationText,
      allScores,
      eliminatedWarehouses,
      weights
    }
  };
};
