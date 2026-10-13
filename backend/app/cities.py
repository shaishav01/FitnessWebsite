"""Indian cities offered in the 'add branch' dropdown: (city, state)."""

CITIES: list[tuple[str, str]] = [
    ("Agra", "Uttar Pradesh"), ("Ahmedabad", "Gujarat"), ("Ajmer", "Rajasthan"),
    ("Amritsar", "Punjab"), ("Aurangabad", "Maharashtra"), ("Bengaluru", "Karnataka"),
    ("Bhopal", "Madhya Pradesh"), ("Bhubaneswar", "Odisha"), ("Chandigarh", "Chandigarh"),
    ("Chennai", "Tamil Nadu"), ("Coimbatore", "Tamil Nadu"), ("Dehradun", "Uttarakhand"),
    ("Delhi", "Delhi"), ("Dhanbad", "Jharkhand"), ("Faridabad", "Haryana"),
    ("Ghaziabad", "Uttar Pradesh"), ("Panaji", "Goa"), ("Gurugram", "Haryana"),
    ("Guwahati", "Assam"), ("Gwalior", "Madhya Pradesh"), ("Hubballi", "Karnataka"),
    ("Hyderabad", "Telangana"), ("Indore", "Madhya Pradesh"), ("Jabalpur", "Madhya Pradesh"),
    ("Jaipur", "Rajasthan"), ("Jalandhar", "Punjab"), ("Jammu", "Jammu and Kashmir"),
    ("Jamshedpur", "Jharkhand"), ("Jodhpur", "Rajasthan"), ("Kanpur", "Uttar Pradesh"),
    ("Kochi", "Kerala"), ("Kolhapur", "Maharashtra"), ("Kolkata", "West Bengal"),
    ("Kozhikode", "Kerala"), ("Lucknow", "Uttar Pradesh"), ("Ludhiana", "Punjab"),
    ("Madurai", "Tamil Nadu"), ("Mangaluru", "Karnataka"), ("Meerut", "Uttar Pradesh"),
    ("Mumbai", "Maharashtra"), ("Mysuru", "Karnataka"), ("Nagpur", "Maharashtra"),
    ("Nashik", "Maharashtra"), ("Navi Mumbai", "Maharashtra"), ("Noida", "Uttar Pradesh"),
    ("Patna", "Bihar"), ("Puducherry", "Puducherry"), ("Pune", "Maharashtra"),
    ("Raipur", "Chhattisgarh"), ("Rajkot", "Gujarat"), ("Ranchi", "Jharkhand"),
    ("Salem", "Tamil Nadu"), ("Shimla", "Himachal Pradesh"), ("Siliguri", "West Bengal"),
    ("Srinagar", "Jammu and Kashmir"), ("Surat", "Gujarat"), ("Thane", "Maharashtra"),
    ("Thiruvananthapuram", "Kerala"), ("Tiruchirappalli", "Tamil Nadu"),
    ("Udaipur", "Rajasthan"), ("Vadodara", "Gujarat"), ("Varanasi", "Uttar Pradesh"),
    ("Vijayawada", "Andhra Pradesh"), ("Visakhapatnam", "Andhra Pradesh"),
]

CITY_TO_STATE = dict(CITIES)
