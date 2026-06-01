<?php
// php/index.php
require 'db.php';

// Stats
$stmt = $pdo->query("SELECT count(*) as total FROM profiles");
$totalSellers = $stmt->fetch()['total'];

$stmt = $pdo->query("SELECT count(*) as total FROM products");
$totalProducts = $stmt->fetch()['total'];

// Sellers
$stmt = $pdo->query("SELECT * FROM profiles ORDER BY created_at DESC");
$sellers = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html>
<head>
    <title>Admin - Sellers</title>
    <style>
        body { font-family: sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .navbar { display: flex; gap: 20px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
        .navbar a { text-decoration: none; color: #10b981; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; background: white; margin-top: 20px; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #f1f5f9; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #ddd; width: 200px; }
    </style>
</head>
<body>
    <div class="navbar">
        <a href="index.php">Sellers</a>
        <a href="products.php">Products</a>
    </div>

    <h1>Admin Dashboard</h1>
    <div class="stats">
        <div class="stat-card"><h3>Total Sellers</h3><p><?= $totalSellers ?></p></div>
        <div class="stat-card"><h3>Total Products</h3><p><?= $totalProducts ?></p></div>
    </div>

    <h2>Seller Profiles</h2>
    <table>
        <tr>
            <th>ID</th>
            <th>Business Name</th>
            <th>Email</th>
            <th>Created At</th>
        </tr>
        <?php foreach ($sellers as $seller): ?>
        <tr>
            <td><?= htmlspecialchars($seller['id']) ?></td>
            <td><?= htmlspecialchars($seller['business_name'] ?? 'N/A') ?></td>
            <td><?= htmlspecialchars($seller['contact_email'] ?? 'N/A') ?></td>
            <td><?= htmlspecialchars($seller['created_at'] ?? 'N/A') ?></td>
        </tr>
        <?php endforeach; ?>
    </table>
</body>
</html>
