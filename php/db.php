<?php
// php/db.php
$host = 'db.ziayrjjwemrllfcdtous.supabase.co';
$port = '5432';
$dbname = 'postgres';
$user = 'postgres';
$password = 'Jayrintia1431';

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage() . ". Ensure you have the PostgreSQL PDO extension enabled in your PHP configuration.");
}
?>
