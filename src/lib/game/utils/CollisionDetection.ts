import * as THREE from 'three';

export class CollisionDetection {
    /**
     * Check if a sphere collides with another sphere
     */
    public static sphereSphereCollision(
        positionA: THREE.Vector3, 
        radiusA: number, 
        positionB: THREE.Vector3, 
        radiusB: number
    ): boolean {
        const distance = positionA.distanceTo(positionB);
        return distance < (radiusA + radiusB);
    }
    
    /**
     * Check if a sphere collides with a box
     */
    public static sphereBoxCollision(
        spherePosition: THREE.Vector3,
        sphereRadius: number,
        boxPosition: THREE.Vector3,
        boxSize: THREE.Vector3
    ): boolean {
        // Calculate box bounds
        const boxMin = new THREE.Vector3(
            boxPosition.x - boxSize.x/2,
            boxPosition.y - boxSize.y/2,
            boxPosition.z - boxSize.z/2
        );
        
        const boxMax = new THREE.Vector3(
            boxPosition.x + boxSize.x/2,
            boxPosition.y + boxSize.y/2,
            boxPosition.z + boxSize.z/2
        );
        
        // Find the closest point on the box to the sphere
        const closestPoint = new THREE.Vector3(
            Math.max(boxMin.x, Math.min(spherePosition.x, boxMax.x)),
            Math.max(boxMin.y, Math.min(spherePosition.y, boxMax.y)),
            Math.max(boxMin.z, Math.min(spherePosition.z, boxMax.z))
        );
        
        // Calculate distance between the closest point and sphere center
        const distance = closestPoint.distanceTo(spherePosition);
        
        // If the distance is less than the sphere radius, there is a collision
        return distance < sphereRadius;
    }
    
    /**
     * Check if a sphere collides with an AABB (Axis-Aligned Bounding Box)
     * This is a simplified version that only checks on the X-Z plane for maze collisions
     */
    public static sphereAABBCollision2D(
        spherePosition: THREE.Vector3,
        sphereRadius: number,
        boxMin: THREE.Vector3,
        boxMax: THREE.Vector3
    ): boolean {
        // Only check X and Z coordinates (horizontal plane)
        if (
            spherePosition.x + sphereRadius > boxMin.x &&
            spherePosition.x - sphereRadius < boxMax.x &&
            spherePosition.z + sphereRadius > boxMin.z &&
            spherePosition.z - sphereRadius < boxMax.z
        ) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if a point is inside an AABB
     */
    public static pointInAABB(
        point: THREE.Vector3,
        boxMin: THREE.Vector3,
        boxMax: THREE.Vector3
    ): boolean {
        return (
            point.x >= boxMin.x && point.x <= boxMax.x &&
            point.y >= boxMin.y && point.y <= boxMax.y &&
            point.z >= boxMin.z && point.z <= boxMax.z
        );
    }
    
    /**
     * Find the closest point on a line segment to a given point
     */
    public static closestPointOnLineSegment(
        point: THREE.Vector3,
        lineStart: THREE.Vector3,
        lineEnd: THREE.Vector3
    ): THREE.Vector3 {
        const line = lineEnd.clone().sub(lineStart);
        const len = line.length();
        line.normalize();
        
        const projection = point.clone().sub(lineStart).dot(line);
        
        if (projection < 0) {
            return lineStart.clone();
        }
        if (projection > len) {
            return lineEnd.clone();
        }
        
        return lineStart.clone().add(line.multiplyScalar(projection));
    }
    
    /**
     * Ray cast from a point in a direction and check for intersection with a sphere
     */
    public static raySphereIntersection(
        rayOrigin: THREE.Vector3,
        rayDirection: THREE.Vector3,
        sphereCenter: THREE.Vector3,
        sphereRadius: number
    ): boolean {
        const rayToSphere = sphereCenter.clone().sub(rayOrigin);
        const tca = rayToSphere.dot(rayDirection);
        
        // If tca is negative, sphere is behind the ray
        if (tca < 0) return false;
        
        const d2 = rayToSphere.dot(rayToSphere) - tca * tca;
        const radiusSquared = sphereRadius * sphereRadius;
        
        // If d2 is larger than radius^2, ray misses the sphere
        if (d2 > radiusSquared) return false;
        
        const thc = Math.sqrt(radiusSquared - d2);
        const t0 = tca - thc;
        const t1 = tca + thc;
        
        // If both t0 and t1 are negative, sphere is behind the ray
        if (t0 < 0 && t1 < 0) return false;
        
        // Ray intersects sphere
        return true;
    }
} 