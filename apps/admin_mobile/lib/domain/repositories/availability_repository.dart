import '../entities/availability.dart';

abstract class AvailabilityRepository {
  Future<List<AvailabilitySlot>> getSlots();
  Future<List<AvailabilitySlot>> updateSlots(List<AvailabilitySlot> slots);
  Future<List<AvailabilityBlock>> getBlocks();
  Future<AvailabilityBlock> createBlock({
    required String date,
    String? startTime,
    String? endTime,
    String? reason,
  });
  Future<void> deleteBlock(int id);
}
