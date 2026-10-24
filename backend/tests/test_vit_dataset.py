import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import HardwareConfigModel, SignalRecord
from engine.allocator import AllocationEngine
from engine.validator import ValidationEngine
from engine.excel_handler import ExcelHandler

SAMPLE_CSV_CONTENT = """OA No.,Technical Room (Signal Location 2),Design Area,Tag Number,TagNumber,Old Tag Number,Instrument Type,Instrument Type Description,Process Function Type,Loop Name,Internal Loop Order,P&ID,Service,Tag Service 1 and 2,Equipment Name,Equipment Description,WBS,Status,Typical_No,Package Number,Location,System 1 (System),System 2,I/O Type Name,I/O Type Name 2,Signal Type,Execution,External Power Supply,Signal Level,Loop Powered,Voting,Asset,Contact Type,Junction Box / Panel,Multi-cable / Cable,Multipair Cable No.,Pair Number,IO Grouping,Logic Number,Point Type,Machine Level,Equipment Type,Monitoring Frequency Of Interest (Hz) (MPS),Measurement Evaluation,Transducer Orientation (MPS),Probe Freq  range Min (MPS),Probe Freq range Max (MPS),Probe Sensitivity (MPS),Probe Model / Part Number,Probe Extension Cable length,Measuring Unit (include the below units into existing list),Key Phasor Measurement,System Tag Name,Controller type,Controller Assignment,System Cabinet Name,Marshalling Cabinet Name,Marshalling Cabinet T.B No,TB 1,TB 2,TB 3,FTA Name,FTA Cable Name,I/O Allocation CIOC/CSLS,Charm Baseplate,Charm Slot,Manufacturer Name,Model Name,Discrete Invert,1 State Word,0 State Word,Discrete Alarm Priority,Discrete Alarm Enable,Analog Range Low Scale,Analog Range High Scale,Analog Range EU,Min Transmitter Calibration Range,Max Transmitter Calibration Range,Transmitter Scale Units,High High High Alarm,High High High Alarm Limit,High High High Alarm Priority,High High Alarm,High High Alarm Limit,High High Alarm Priority,High Alarm,High Alarm Limit,High Alarm Priority,Low Alarm,Low Alarm Limit,Low Alarm Priority,Low Low Alarm,Low Low Alarm Limit,Low Low Alarm Priority,Low Low Low Alarm,Low Low Low Alarm Limit,Low Low Low Alarm Priority,Alarm Deadband,Square Root,Low Cutoff Value,Module Scan Rate,Main Display,Friendly Name,Parent,Loop Reference 1,Loop Reference 2,I/O Allocation EIOC,I/O Allocation Physical Device Name,I/O Allocation Logical Device Name,I/O Allocation Register Name,SP Track PV in MAN,SP Low Range,SP High Range,PID Control Direction,P Action,I Action,D Action,Master-Slave Reference,Valve Action,Allowable Valve Travel Time,Revision #,Revision Change Type,Revision Comments,Revision Date,Alarm_Set_Point,Alarm_Priority,IRP_Cabinet_Name,Feed_Name,Feed_From,Feed_TS_Name,Feed_TS_Term,Ele_Cable_name,Ele_Cable_Type,Ele_Cable_Term,Ele_TS_Name,Ele_TS_Term,Relay_Name,Relay_Model,Relay_Contact,Relay_Term_Coil,Relay_Term_Contact,SYS_TS_Name,SYS_TS_Term
OA-11,PIB-30,RA 320-01,320-FT   -20645-A,320FT20645A,-,FT,dP Flow Transmitter,Flow,320-F -20645,30,PID-320200601,LPN TO 320-F-2011 ETHYLENE TREATER REGENERATION HEATER,LPN TO F-2011 ETH HTR,-,,320,New,-,-,L,DCS,-,AIR,-,4-20 ma HART,NON-IS,-,2-Wire,Yes,-,-,-,320-JE-0001,24PX1MM2/FR/IND&OS/ARM/NIS,320-CE-0001,Pair 1,A-CONTROL,320-UC-20060,,,,,,,,,,,,,,320FT20645A,,,,,,,,,,,,,,,,-,-,-,-,-,0,9,ton/h,,,,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,0.05,N,,,,,,,,,,,,,,,-,,,,,-,,05B+,PDR-1,Range updated,2025-10-05,-,-,,,,,,-,-,-,,,,,,,,,
OA-11,PIB-30,RA 320-01,320-FV   -20645,320FV20645,-,FV,Control Valve,Control Valve,320-F -20645,80,PID-320200601,LPN TO 320-F-2011 ETHYLENE TREATER REGENERATION HEATER,LPN TO F-2011 ETH HTR,-,,320,New,-,-,L,DCS,-,AOR,-,4-20 ma HART,NON-IS,-,2-Wire,-,-,-,-,320-JE-0001,24PX1MM2/FR/IND&OS/ARM/NIS,320-CE-0001,Pair 2,A,-,,,,,,,,,,,,,,320FV20645,,,,,,,,,,,,,,,,-,-,-,-,-,-,-,-,,,,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,0.05,-,,,,,,,,,,,,,,,-,,,,,FC,,01,PDR-1,-,2024-06-14,,,,,,,,-,-,-,,,,,,,,,
OA-11,PIB-30,RA 320-01,320-XYV  -20202,320XYV20202,-,XYV,Solenoid Valve,Control Valve,320-X -20202,70,PID-320200202,HEXENE FROM 320-G-2032-B DISCHARGE,HXE FRM G-2032-B DISCH,-,,320,New,TYPICAL E2,-,L,DCS,-,DOR,-,-,NON-IS,-,Volt-contact,-,-,-,-,320-JS-0005,12PX2.5MM2/FR/ARM/NIS,320-CS-0005,Pair 2,B,320-UC-20070,,,,,,,,,,,,,,320XYV20202,,,,,,,,,,,,,,,,-,OPEN,CLOSE,LOG,T,-,-,-,,,,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,,-,,,,,,,,,,,,,,,-,,,,,-,,01,PDR-1,-,2024-06-14,,,,,,,,-,-,-,,,,,,,,,
OA-11,PIB-30,RA 320-01,320-FT   -42044,320FT42044,-,FT,Coriolis Meter,Flow,320-F -42044,30,PID-320402001,RECYCLE ISOBUTANE TO 320-C-5041 DEHEX COLUMN,RIB TO C-5041 DEHEX COL,-,,320,New,-,-,L,DCS,-,AIR,-,4-20 ma HART,NON-IS,230VAC,4-Wire,No,-,-,-,320-JE-0087,24PX1MM2/FR/IND&OS/ARM/NIS,320-CE-0087,Pair 1,-,-,,,,,,,,,,,,,,320FT42044,,,,,,,,,,,,,,,,-,-,-,-,-,0,21,ton/h,,,,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,,-,,,,,,,,,,,,,,,-,,,,,-,,05B+,PDR-1,Range updated,2025-10-05,-,-,,,,,,-,-,-,,,,,,,,,
OA-14,PIB-24,RA 500-02,500-XA   -00322-L,500XA00322L,-,XA,Alarm,General,500-X -00322,34,PID-500000301,EARTHING CONNECTION,GRND CONN,-,,500,Modified,-,-,LP,DCS,-,DO,-,-,NON-IS,-,Volt-contact,-,-,-,-,500-LP-0003,24PX2.5MM2/FR/ARM/NIS,500-CE-LP-0003-B,Pair 1,-,500-UC-00030,,,,,,,,,,,,,,500XA00322L,,,,,,,,,,,,,,,,-,LAMP ON,LAMP OFF,ADVISORY,T,-,-,-,,,,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,,-,,,,,,,,,,,,,,,-,,,,,-,,04,PDR-1,Wiring Updated,2024-11-15,,,,,,,,-,-,-,,,,,,,,,
OA-14,PIB-24,RA 500-02,500-XS   -00322,500XS00322,-,XS,Switch,General,500-X -00322,34,PID-500000301,EARTHING CONNECTION,GRND CONN,-,,500,New,-,-,L,DCS,-,DIR,-,-,NON-IS,-,Voltfree-contact,-,-,-,NC,500-JE-0015,12PX1MM2/FR/IND&OS/ARM/NIS,500-CE-0015,Pair 1,-,500-UC-00030,,,,,,,,,,,,,,500XS00322,,,,,,,,,,,,,,,,F,ACTIVE,NOT ACTIVE,LOG,T,-,-,-,,,,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,,-,,,,,,,,,,,,,,,-,,,,,-,,05B,PDR-1,Wiring Updated,2025-07-16,,,,,,,,-,-,-,,,,,,,,,
OA-11,PIB-30,RA 320-01,320-EJA  -01001-T,320EJA01001T,-,EJA,Cabinet Diagnostic Alarm,General,320-E -01001,-,-,P30-DCM-32001-01 TEMPERATURE,P30-DCM-32001-01 TEMPERATURE,P30-DCM-32001-01,DCS Marshalling Cabinet,320,New,-,-,PIB-30,DCS,-,AIR,-,RTD,NON-IS,-,3-Wire,-,-,-,-,-,-,Internal Wiring,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,320EJA01001T,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,,,,-,-,0,100,deg C,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,NA,NA,NA,NA,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-
"""

def test_vit_dataset_inspection_and_allocation():
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", encoding="utf-8") as f:
        f.write(SAMPLE_CSV_CONTENT)
        temp_path = f.name

    try:
        # 1. Test Workbook Inspection
        inspection = ExcelHandler.inspect_workbook(temp_path)
        assert "Master_IO_Database" in inspection["sheets"]
        headers = inspection["headers"]["Master_IO_Database"]
        suggested = inspection["suggested_mappings"]

        # Confirm auto-mapping suggestions worked accurately
        assert suggested.get("tag") == "Tag Number"
        assert suggested.get("description") == "Tag Service 1 and 2"
        assert suggested.get("signal_type") == "I/O Type Name"
        assert suggested.get("cable_id") == "Multipair Cable No."
        assert suggested.get("pair_number") == "Pair Number"
        assert suggested.get("redundancy") == "IO Grouping"

        # 2. Test Signal Parsing
        signals = ExcelHandler.parse_mapped_signals(temp_path, "Master_IO_Database", suggested)
        assert len(signals) == 7

        # Verify parsed properties
        ft_sig = next(s for s in signals if "320-FT   -20645-A" in s.tag)
        assert ft_sig.signal_type == "AIR"
        assert ft_sig.cable_id == "320-CE-0001"
        assert ft_sig.pair_number == 1
        assert "A" in ft_sig.redundancy

        # 3. Test Allocation Engine
        config = HardwareConfigModel()
        engine = AllocationEngine(config)
        assignments = engine.run_allocation(signals)

        assert len(assignments) == 7
        for a in assignments:
            assert a.status == "Allocated"
            assert a.cabinet_id is not None
            assert a.cioc_id is not None
            assert a.baseplate_id is not None
            assert a.channel_no is not None
            assert a.charm_no is not None
            # CHARM number formula: (baseplate - 1) * 12 + channel
            bp_num = int(a.baseplate_id.split("-")[-1])
            expected_charm_no = (bp_num - 1) * 12 + a.channel_no
            assert a.charm_no == expected_charm_no

        # Check RTD hardware mapping for Cabinet Alarm
        rtd_assign = next(a for a in assignments if "320-EJA  -01001-T" in a.tag)
        assert rtd_assign.charm_part_no == "SE4303T03"
        assert rtd_assign.charm_tb_terminals == "1, 2, 4"

        # Check Isolated DO for Solenoid Valve
        sov_assign = next(a for a in assignments if "320-XYV  -20202" in a.tag)
        assert sov_assign.charm_part_no == "SE4302T02"
        assert sov_assign.charm_tb_part_no == "SE4502"
        assert sov_assign.charm_tb_terminals == "-, 2, 4"

        # Check A/B Redundancy Separation:
        # 320-FT-20645-A has redundancy A-CONTROL
        # 320-XYV-20202 has redundancy B
        # They MUST NOT share the same CIOC!
        a_cioc = ft_assign = next(a for a in assignments if "320-FT   -20645-A" in a.tag).cioc_id
        b_cioc = sov_assign.cioc_id
        assert a_cioc != b_cioc

        # 4. Test Validation Engine
        validator = ValidationEngine(config)
        summary = validator.validate(signals, assignments)
        assert summary.is_fully_validated
        assert summary.error_count == 0

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
